import { useTranslation } from "react-i18next";
import { FaChair } from "react-icons/fa";
import type { SeatLayoutJson, VehicleDeck, VehicleSeat } from "../../../api/vietride";
import { getSeatColumnCount, isPassengerSeat } from "./vehicleSeatHelpers";

type VehicleSeatLayoutProps = {
  layout: SeatLayoutJson | null;
  editable?: boolean;
  disabled?: boolean;
  onToggle?: (seatNumber: string) => void;
};

function getDecks(layout: SeatLayoutJson): VehicleDeck[] {
  const byDeck = new Map<number, VehicleSeat[]>();

  layout.seats.forEach((seat) => {
    const deck = seat.deck ?? 1;
    const seats = byDeck.get(deck) ?? [];
    seats.push(seat);
    byDeck.set(deck, seats);
  });

  return [...byDeck.entries()]
    .sort(([left], [right]) => left - right)
    .map(([deck, seats]) => ({
      deck,
      seats: [...seats].sort((left, right) => {
        if (left.row !== right.row) {
          return left.row - right.row;
        }

        return left.col - right.col;
      }),
    }));
}
function seatLabel(seat: VehicleSeat): string {
  if (seat.type === "DRIVER_AREA") {
    return "Khu tài xế";
  }

  return seat.disabled ? "Ghế đang khóa" : "Ghế đang hoạt động";
}

export function VehicleSeatLayout({
  layout,
  editable = false,
  disabled = false,
  onToggle,
}: VehicleSeatLayoutProps) {
  const { t } = useTranslation("manager");

  if (!layout || layout.seats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t("vehicles.noSeatMap", { defaultValue: "Chưa có sơ đồ ghế." })}
      </div>
    );
  }

  const decks = getDecks(layout);
  const columnCount = getSeatColumnCount(layout);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-vr-500" />
          {t("vehicles.activeSeat", { defaultValue: "Đang hoạt động" })}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          {t("vehicles.disabledSeat", { defaultValue: "Đã khóa" })}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          {t("vehicles.driverArea", { defaultValue: "Khu tài xế" })}
        </span>
      </div>

      {decks.map((deck) => (
        <section
          key={deck.deck}
          className="rounded-xl border border-gray-200 bg-gray-50/70 p-3"
          aria-label={t("vehicles.deckLabel", {
            deck: deck.deck,
            defaultValue: `Tầng ${deck.deck}`,
          })}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              {t("vehicles.deckLabel", {
                deck: deck.deck,
                defaultValue: `Tầng ${deck.deck}`,
              })}
            </h4>
            <span className="text-xs tabular-nums text-gray-500">
              {t("vehicles.generatedSeats", {
                count: deck.seats.length,
                defaultValue: `${deck.seats.length} vị trí`,
              })}
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(2.75rem, 1fr))`,
            }}
          >
            {deck.seats.map((seat) => {
              const passengerSeat = isPassengerSeat(seat);
              const canToggle = editable && passengerSeat && Boolean(onToggle);
              const className = `flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition ${
                seat.type === "DRIVER_AREA"
                  ? "border-slate-700 bg-slate-700 text-white"
                  : seat.disabled
                    ? "border-gray-200 bg-gray-100 text-gray-400"
                    : "border-vr-200 bg-vr-50 text-vr-700"
              } ${
                canToggle
                  ? "cursor-pointer hover:-translate-y-0.5 hover:border-vr-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-vr-500/40"
                  : ""
              } ${disabled ? "cursor-wait opacity-70" : ""}`;
              const title = `${seat.seatNumber} · ${seatLabel(seat)} · hàng ${seat.row}, cột ${seat.col}`;

              if (canToggle) {
                return (
                  <button
                    key={`${deck.deck}-${seat.seatNumber}`}
                    type="button"
                    className={className}
                    disabled={disabled}
                    aria-pressed={!seat.disabled}
                    aria-label={title}
                    title={title}
                    onClick={() => onToggle?.(seat.seatNumber)}
                  >
                    <FaChair size={16} aria-hidden="true" />
                    <span>{seat.seatNumber}</span>
                  </button>
                );
              }

              return (
                <div
                  key={`${deck.deck}-${seat.seatNumber}`}
                  className={className}
                  title={title}
                  aria-label={title}
                >
                  <FaChair size={16} aria-hidden="true" />
                  <span>{seat.seatNumber}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
