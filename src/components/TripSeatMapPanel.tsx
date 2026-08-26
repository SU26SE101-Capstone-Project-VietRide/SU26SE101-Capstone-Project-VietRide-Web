import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import { PiBus, PiPath } from "react-icons/pi";
import {
  disableOperatorTripSeat,
  enableOperatorTripSeat,
  getPublicTripSeatMap,
  type TripSeatMap,
  type TripSeatMapSeat,
} from "../api/vietride";

/**
 * Sơ đồ ghế của MỘT chuyến — khác hẳn sơ đồ ghế ở màn Phương tiện (đó là mẫu ghế
 * của xe, không có trạng thái bán).
 *
 * Trạng thái do BE khoá 4 giá trị (`TripSeatStatus`): AVAILABLE / HELD / BOOKED /
 * UNAVAILABLE. `HELD` là ghế khách đang giữ chỗ chờ thanh toán — hết hạn giữ thì
 * BE tự nhả về AVAILABLE, nên panel có nút tải lại thay vì tự poll: nhà xe chỉ mở
 * ra xem lúc cần, poll nền sẽ tốn request vô ích.
 *
 * Hai chế độ:
 * - Mặc định (màn Lượt đặt vé): chỉ đọc, ghế là `<span>`.
 * - `manageable` (màn Chuyến xe): ghế AVAILABLE/UNAVAILABLE thành nút để nhà xe
 *   khoá/mở ghế. Ghế HELD/BOOKED vẫn không bấm được — BE trả `409
 *   TRIP_SEAT_IN_USE` cho chúng, chặn sẵn ở đây để khỏi bắt người dùng ăn lỗi.
 *
 * Khoá/mở ghế trả về SƠ ĐỒ MỚI nguyên vẹn, nên panel thay cả `seatMap` bằng
 * response thay vì sửa một ghế trong state — BE có thể đổi kèm thứ khác.
 *
 * Khoá i18n vẫn nằm dưới `manager:bookings.*` từ thời component ở trong thư mục
 * màn Lượt đặt vé; giữ nguyên để khỏi phải đổi cả bộ dịch lẫn test của màn đó.
 */
const seatStatusClass: Record<string, string> = {
  AVAILABLE: "border-gray-200 bg-white text-gray-600",
  HELD: "border-amber-300 bg-amber-50 text-amber-800",
  BOOKED: "border-vr-300 bg-vr-50 text-vr-800",
  UNAVAILABLE: "border-gray-200 bg-gray-100 text-gray-500 line-through",
};

const LEGEND_STATUSES = [
  "AVAILABLE",
  "HELD",
  "BOOKED",
  "UNAVAILABLE",
] as const;

type SeatGridColumn =
  | { kind: "seat"; col: number }
  | { kind: "aisle"; afterCol: number };

function buildGridColumns(
  seats: TripSeatMapSeat[],
  aisles: TripSeatMap["aisles"],
): SeatGridColumn[] {
  const aisleColumns = new Set(
    (aisles ?? [])
      .map((aisle) => aisle.afterCol)
      .filter((afterCol) => afterCol > 0),
  );
  const columnCount = Math.max(
    ...seats.map((seat) => seat.col),
    ...[...aisleColumns].map((afterCol) => afterCol + 1),
    1,
  );
  const columns: SeatGridColumn[] = [];

  for (let col = 1; col <= columnCount; col += 1) {
    columns.push({ kind: "seat", col });
    if (aisleColumns.has(col) && col < columnCount) {
      columns.push({ kind: "aisle", afterCol: col });
    }
  }

  return columns;
}

function groupByDeckAndRow(seats: TripSeatMapSeat[]) {
  const decks = new Map<number, Map<number, TripSeatMapSeat[]>>();

  for (const seat of seats) {
    const deck = seat.deck ?? 1;
    const rows = decks.get(deck) ?? new Map<number, TripSeatMapSeat[]>();
    const row = rows.get(seat.row) ?? [];
    row.push(seat);
    rows.set(seat.row, row);
    decks.set(deck, rows);
  }

  return [...decks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([deck, rows]) => ({
      deck,
      rows: [...rows.entries()]
        .sort(([left], [right]) => left - right)
        .map(([row, rowSeats]) => ({
          row,
          seats: [...rowSeats].sort((left, right) => left.col - right.col),
        })),
    }));
}

/** Ghế đang có khách thì không khoá/mở được — BE từ chối bằng `TRIP_SEAT_IN_USE`. */
const LOCKED_SEAT_STATUSES = new Set(["HELD", "BOOKED"]);

type TripSeatMapPanelProps = {
  tripId: string;
  /** Bật nút khoá/mở ghế. Chỉ truyền `true` cho OPERATOR_ADMIN. */
  manageable?: boolean;
  /** Báo cho màn cha biết sơ đồ vừa đổi (để nó tải lại số liệu chuyến). */
  onSeatsChanged?: (seatMap: TripSeatMap) => void;
};

export default function TripSeatMapPanel({
  tripId,
  manageable = false,
  onSeatsChanged,
}: TripSeatMapPanelProps) {
  const { t } = useTranslation("manager");
  const [seatMap, setSeatMap] = useState<TripSeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySeatNumber, setBusySeatNumber] = useState("");

  // `t` đổi identity mỗi lần đổi ngôn ngữ; để nó trong deps của `load` là effect
  // bên dưới bắn lại và gọi API thừa. Giữ qua ref theo đúng pattern các màn khác.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const load = useCallback(async () => {
    if (!tripId) return;
    setIsLoading(true);
    setError("");
    try {
      setSeatMap(await getPublicTripSeatMap(tripId));
    } catch (err) {
      setSeatMap(null);
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("bookings.seatMapLoadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    // Giữ queueMicrotask để thoả rule react-hooks/set-state-in-effect
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  /**
   * Khoá ghế trống / mở lại ghế đã khoá.
   *
   * KHÔNG hỏi lý do: đây là thao tác đảo được ngay bằng chính nút đó, bắt gõ lý
   * do cho mỗi ghế trong lúc đang xếp xe là cản trở chứ không phải kiểm soát.
   * BE khai `reason` là optional nên bỏ trống hợp lệ.
   */
  async function toggleSeat(seat: TripSeatMapSeat) {
    if (!manageable || LOCKED_SEAT_STATUSES.has(seat.status)) return;

    setBusySeatNumber(seat.seatNumber);
    setError("");
    try {
      const updated =
        seat.status === "UNAVAILABLE"
          ? await enableOperatorTripSeat(tripId, seat.seatNumber)
          : await disableOperatorTripSeat(tripId, seat.seatNumber);
      setSeatMap(updated);
      onSeatsChanged?.(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("bookings.seatToggleFailed"),
      );
    } finally {
      setBusySeatNumber("");
    }
  }

  const decks = seatMap ? groupByDeckAndRow(seatMap.seats) : [];
  const gridColumns = seatMap
    ? buildGridColumns(seatMap.seats, seatMap.aisles)
    : [];
  const gridTemplateColumns = `2.5rem ${gridColumns
    .map((column) => column.kind === "aisle" ? "2.25rem" : "3.25rem")
    .join(" ")}`;
  const counts = (seatMap?.seats ?? []).reduce<Record<string, number>>(
    (acc, seat) => {
      acc[seat.status] = (acc[seat.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 sm:px-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            {t("bookings.seatMapTitle")}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {manageable
              ? t("bookings.seatMapManageHint")
              : t("bookings.seatMapHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw aria-hidden="true" size={14} />
          {t("bookings.seatMapRefresh")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        {LEGEND_STATUSES.map((status) => (
          <span
            key={status}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600"
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded border ${seatStatusClass[status]}`}
            />
            {t(`bookings.seatStatus.${status}`)}
            {counts[status] ? ` (${counts[status]})` : ""}
          </span>
        ))}
      </div>

      {/* Lỗi hiện THÊM chứ không THAY sơ đồ: khoá một ghế hỏng thì phần còn
          lại của sơ đồ vẫn đúng và vẫn phải nhìn được — nuốt mất cả lưới chỉ vì
          một ghế từ chối là mất luôn ngữ cảnh để thử ghế khác. Chỉ khi chưa có
          sơ đồ nào (lỗi lúc tải) thì mới không còn gì để vẽ. */}
      {error && (
        <p
          role="alert"
          className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {isLoading && !seatMap ? (
        <p className="p-5 text-sm text-gray-500">{t("bookings.seatMapLoading")}</p>
      ) : decks.length === 0 ? (
        // Lỗi tải đã nói rõ lý do rồi, thêm "chưa có dữ liệu ghế" là mâu thuẫn.
        error ? null : (
          <p className="p-5 text-sm text-gray-500">{t("bookings.seatMapEmpty")}</p>
        )
      ) : (
        <div className="flex flex-wrap items-start justify-center gap-8 bg-slate-50/60 p-5 sm:p-8">
          {decks.map(({ deck, rows }) => (
            <div key={deck} className="w-fit max-w-full">
              {decks.length > 1 && (
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("bookings.seatMapDeck", { deck })}
                </p>
              )}
              <div className="overflow-x-auto rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <PiBus aria-hidden="true" className="text-vr-800" size={17} />
                    {t("vehicles.frontOfVehicle", { defaultValue: "Đầu xe" })}
                  </span>
                  <PiPath aria-hidden="true" className="text-slate-400" size={16} />
                </div>
                <div
                  role="grid"
                  aria-rowcount={rows.length}
                  aria-colcount={gridColumns.length + 1}
                  className="w-fit space-y-3"
                >
                  {rows.map(({ row, seats }) => (
                    <div
                      key={row}
                      role="row"
                      className="grid gap-3"
                      style={{ gridTemplateColumns }}
                    >
                      <span
                        className="flex h-12 items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold tabular-nums text-slate-400"
                        aria-label={t("vehicles.rowLabel", {
                          row,
                          defaultValue: `Hàng ${row}`,
                        })}
                      >
                        {row}
                      </span>
                      {gridColumns.map((column) => {
                        if (column.kind === "aisle") {
                          return (
                            <span
                              key={`aisle-${row}-${column.afterCol}`}
                              role="gridcell"
                              className="relative flex h-12 items-center justify-center rounded-full bg-vr-50/70 after:h-7 after:border-l after:border-dashed after:border-vr-300"
                              aria-label={t("vehicles.aisleAfterColumn", {
                                column: column.afterCol,
                                defaultValue: `Lối đi sau cột ${column.afterCol}`,
                              })}
                            />
                          );
                        }

                        const seat = seats.find((item) => item.col === column.col);
                        if (!seat) {
                          return (
                            <span
                              key={`empty-${deck}-${row}-${column.col}`}
                              role="gridcell"
                              className="h-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/50"
                              aria-label={t("vehicles.emptyPosition", {
                                row,
                                col: column.col,
                                defaultValue: "Vị trí trống",
                              })}
                            />
                          );
                        }

                        const seatKey = `${seat.deck}-${seat.row}-${seat.col}-${seat.seatNumber}`;
                        const seatLabel = `${seat.seatNumber} · ${t(`bookings.seatStatus.${seat.status}`, { defaultValue: seat.status })}`;
                        const seatClass = `inline-flex h-12 min-w-[3.25rem] items-center justify-center rounded-xl border px-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${seatStatusClass[seat.status] ?? seatStatusClass.UNAVAILABLE}`;
                        const isSeatLocked = LOCKED_SEAT_STATUSES.has(seat.status);

                        if (!manageable || isSeatLocked) {
                          return (
                            <span
                              key={seatKey}
                              role="gridcell"
                              title={seatLabel}
                              className={seatClass}
                            >
                              {seat.seatNumber}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={seatKey}
                            type="button"
                            role="gridcell"
                            disabled={Boolean(busySeatNumber)}
                            onClick={() => void toggleSeat(seat)}
                            /* Nhãn nói rõ BẤM VÀO SẼ LÀM GÌ, không chỉ trạng
                               thái hiện tại — chữ trong ô chỉ là số ghế nên
                               accessible name phải gánh phần còn lại. */
                            aria-label={`${seatLabel} — ${
                              seat.status === "UNAVAILABLE"
                                ? t("bookings.seatEnableAction")
                                : t("bookings.seatDisableAction")
                            }`}
                            className={`${seatClass} cursor-pointer focus:outline-none focus:ring-2 focus:ring-vr-300 disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {seat.seatNumber}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
