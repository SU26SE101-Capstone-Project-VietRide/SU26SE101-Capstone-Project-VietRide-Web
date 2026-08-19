import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
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
  const counts = (seatMap?.seats ?? []).reduce<Record<string, number>>(
    (acc, seat) => {
      acc[seat.status] = (acc[seat.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw aria-hidden="true" size={14} />
          {t("bookings.seatMapRefresh")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND_STATUSES.map((status) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600"
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
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : isLoading && !seatMap ? (
        <p className="mt-4 text-sm text-gray-500">{t("bookings.seatMapLoading")}</p>
      ) : decks.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t("bookings.seatMapEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {decks.map(({ deck, rows }) => (
            <div key={deck}>
              {decks.length > 1 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("bookings.seatMapDeck", { deck })}
                </p>
              )}
              <div className="space-y-1.5">
                {rows.map(({ row, seats }) => (
                  <div key={row} className="flex flex-wrap gap-1.5">
                    {seats.map((seat) => (
                      <span
                        key={`${seat.deck}-${seat.row}-${seat.col}-${seat.seatNumber}`}
                        title={`${seat.seatNumber} · ${t(`bookings.seatStatus.${seat.status}`, { defaultValue: seat.status })}`}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-1.5 text-xs font-semibold ${seatStatusClass[seat.status] ?? seatStatusClass.UNAVAILABLE}`}
                      >
                        {seat.seatNumber}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
