import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import { PiBus, PiPath } from "react-icons/pi";
import {
  getPublicTripSeatMap,
  type TripSeatMap,
  type TripSeatMapSeat,
} from "../../../api/vietride";

/**
 * Sơ đồ ghế của MỘT chuyến — khác hẳn sơ đồ ghế ở màn Phương tiện (đó là mẫu ghế
 * của xe, không có trạng thái bán).
 *
 * Trạng thái do BE khoá 4 giá trị (`TripSeatStatus`): AVAILABLE / HELD / BOOKED /
 * UNAVAILABLE. `HELD` là ghế khách đang giữ chỗ chờ thanh toán — hết hạn giữ thì
 * BE tự nhả về AVAILABLE, nên panel có nút tải lại thay vì tự poll: nhà xe chỉ mở
 * ra xem lúc cần, poll nền sẽ tốn request vô ích.
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

export default function TripSeatMapPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation("manager");
  const [seatMap, setSeatMap] = useState<TripSeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
            {t("bookings.seatMapHint")}
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

      {error ? (
        <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : isLoading && !seatMap ? (
        <p className="p-5 text-sm text-gray-500">{t("bookings.seatMapLoading")}</p>
      ) : decks.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">{t("bookings.seatMapEmpty")}</p>
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

                        return (
                          <span
                            key={`${seat.deck}-${seat.row}-${seat.col}-${seat.seatNumber}`}
                            role="gridcell"
                            title={`${seat.seatNumber} · ${t(`bookings.seatStatus.${seat.status}`, { defaultValue: seat.status })}`}
                            className={`inline-flex h-12 min-w-[3.25rem] items-center justify-center rounded-xl border px-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${seatStatusClass[seat.status] ?? seatStatusClass.UNAVAILABLE}`}
                          >
                            {seat.seatNumber}
                          </span>
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
