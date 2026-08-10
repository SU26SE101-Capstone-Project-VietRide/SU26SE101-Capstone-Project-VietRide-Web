import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  PiArmchair,
  PiBed,
  PiBus,
  PiChair,
  PiPath,
  PiProhibit,
  PiSteeringWheel,
} from "react-icons/pi";
import type {
  SeatLayoutJson,
  VehicleSeat,
  VehicleSeatType,
} from "../../../api/vietride";
import {
  getDeckNumbers,
  getSeatColumnCount,
  getSeatCoordinateKey,
  getSeatRowCount,
  isPassengerSeat,
} from "./vehicleSeatHelpers";

export type VehicleSeatLayoutMode =
  | "readonly"
  | "toggle-disabled";

type VehicleSeatLayoutProps = {
  layout: SeatLayoutJson | null;
  mode?: VehicleSeatLayoutMode;
  disabled?: boolean;
  baseline?: SeatLayoutJson | null;
  onToggle?: (seatNumber: string) => void;
};

type SeatGridColumn =
  | { kind: "seat"; col: number }
  | { kind: "aisle"; afterCol: number };

function getSeatTypeLabel(
  type: VehicleSeatType,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t(`vehicles.seatTypeLabels.${type}`, { defaultValue: type });
}

function getSeatLabel(
  seat: VehicleSeat,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const typeLabel = getSeatTypeLabel(seat.type, t);
  const stateLabel = seat.disabled
    ? t("vehicles.disabledSeat", { defaultValue: "Đã khóa" })
    : t("vehicles.activeSeat", { defaultValue: "Đang hoạt động" });

  return `${seat.seatNumber} · ${typeLabel} · ${stateLabel} · ${t("vehicles.rowColumn", {
    row: seat.row,
    col: seat.col,
    defaultValue: `hàng ${seat.row}, cột ${seat.col}`,
  })}`;
}

function getSeatIcon(type: VehicleSeatType): ReactNode {
  switch (type) {
    case "VIP":
      return <PiArmchair aria-hidden="true" />;
    case "SLEEPER_LOWER":
    case "SLEEPER_UPPER":
      return <PiBed aria-hidden="true" />;
    case "DRIVER_AREA":
      return <PiSteeringWheel aria-hidden="true" />;
    default:
      return <PiChair aria-hidden="true" />;
  }
}

function getSeatTone(seat: VehicleSeat): string {
  if (seat.type === "DRIVER_AREA") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (seat.disabled) {
    return "border-gray-200 bg-gray-100 text-gray-400";
  }

  switch (seat.type) {
    case "VIP":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "SLEEPER_LOWER":
    case "SLEEPER_UPPER":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    default:
      return "border-vr-200 bg-vr-50 text-vr-800";
  }
}

function buildGridColumns(
  columnCount: number,
  aisles: number[],
): SeatGridColumn[] {
  const columns: SeatGridColumn[] = [];
  const aisleSet = new Set(aisles);

  for (let col = 1; col <= columnCount; col += 1) {
    columns.push({ kind: "seat", col });
    if (aisleSet.has(col)) {
      columns.push({ kind: "aisle", afterCol: col });
    }
  }

  return columns;
}

function SeatTypeIcon({ type }: { type: VehicleSeatType }) {
  return <span className="text-lg leading-none">{getSeatIcon(type)}</span>;
}

export function VehicleSeatLayout({
  layout,
  mode = "readonly",
  disabled = false,
  baseline,
  onToggle,
}: VehicleSeatLayoutProps) {
  const { t } = useTranslation("manager");
  const [selectedDeck, setSelectedDeck] = useState<number>();

  const deckNumbers = useMemo(
    () => (layout ? getDeckNumbers(layout) : []),
    [layout],
  );
  const activeDeck = deckNumbers.includes(selectedDeck ?? -1)
    ? selectedDeck!
    : deckNumbers[0];
  const columnCount = layout ? getSeatColumnCount(layout) : 1;
  const rowCount = layout && activeDeck
    ? getSeatRowCount(layout, activeDeck)
    : 1;
  const aisleColumns = layout
      ? [...new Set(
        (layout.aisles ?? [])
          .map((aisle) => aisle.afterCol)
          .filter((afterCol) => afterCol > 0 && afterCol < columnCount),
      )].sort((left, right) => left - right)
    : [];
  const gridColumns = buildGridColumns(columnCount, aisleColumns);
  const seatsByCoordinate = useMemo(() => {
    const next = new Map<string, VehicleSeat>();
    layout?.seats.forEach((seat) => {
      next.set(getSeatCoordinateKey(seat), seat);
    });
    return next;
  }, [layout]);
  const baselineByCoordinate = useMemo(() => {
    const next = new Map<string, VehicleSeat>();
    baseline?.seats.forEach((seat) => {
      next.set(getSeatCoordinateKey(seat), seat);
    });
    return next;
  }, [baseline]);

  if (!layout || layout.seats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        {t("vehicles.noSeatMap", { defaultValue: "Chưa có sơ đồ ghế." })}
      </div>
    );
  }
  const hasDriverArea = layout.seats.some((seat) => seat.type === "DRIVER_AREA");


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <PiBus className="text-vr-700" size={18} aria-hidden="true" />
          <span>{t("vehicles.frontOfVehicle", { defaultValue: "Đầu xe" })}</span>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("vehicles.deckSelector", { defaultValue: "Chọn tầng" })}>
          {deckNumbers.map((deck) => {
            const deckSeats = layout.seats.filter((seat) => (seat.deck ?? 1) === deck);
            const isActive = deck === activeDeck;

            return (
              <button
                key={deck}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedDeck(deck)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-vr-500/40 ${
                  isActive
                    ? "bg-vr-500 text-slate-950 shadow-sm"
                    : "bg-white text-slate-600 hover:bg-vr-50 hover:text-vr-800"
                }`}
              >
                {t("vehicles.deckLabel", { deck, defaultValue: `Tầng ${deck}` })}
                <span className="ml-1.5 text-xs opacity-70">{deckSeats.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-vr-500" />
          {t("vehicles.activeSeat", { defaultValue: "Đang hoạt động" })}
        </span>
        <span className="inline-flex items-center gap-2">
          <PiProhibit className="text-gray-400" aria-hidden="true" />
          {t("vehicles.disabledSeat", { defaultValue: "Đã khóa" })}
        </span>
        {hasDriverArea && (
          <span className="inline-flex items-center gap-2">
            <PiSteeringWheel className="text-slate-600" aria-hidden="true" />
            {t("vehicles.driverArea", { defaultValue: "Khu tài xế" })}
          </span>
        )}
        <span className="inline-flex items-center gap-2 text-gray-500">
          <PiPath aria-hidden="true" />
          {t("vehicles.aisle", { defaultValue: "Lối đi" })}
        </span>
      </div>

      <section
        className="overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5"
        aria-label={t("vehicles.deckLabel", {
          deck: activeDeck,
          defaultValue: `Tầng ${activeDeck}`,
        })}
      >
        <div
          className="mx-auto min-w-[29rem] max-w-3xl rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3 sm:p-4"
          role="grid"
          aria-rowcount={rowCount}
          aria-colcount={gridColumns.length + 1}
        >
          <div
            className="grid items-center gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
            style={{ gridTemplateColumns: `2rem repeat(${gridColumns.length}, minmax(3.1rem, 1fr))` }}
          >
            <span aria-hidden="true" />
            {gridColumns.map((column) => (
              <span key={column.kind === "seat" ? `col-${column.col}` : `aisle-${column.afterCol}`} className="text-center">
                {column.kind === "seat" ? column.col : "·"}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const row = rowIndex + 1;

              return (
                <div
                  key={row}
                  role="row"
                  className="grid items-stretch gap-2"
                  style={{ gridTemplateColumns: `2rem repeat(${gridColumns.length}, minmax(3.1rem, 1fr))` }}
                >
                  <span className="flex items-center justify-center text-xs font-semibold tabular-nums text-slate-400" aria-label={t("vehicles.rowLabel", { row, defaultValue: `Hàng ${row}` })}>
                    {row}
                  </span>
                  {gridColumns.map((column) => {
                    if (column.kind === "aisle") {
                      return (
                        <div
                          key={`aisle-${row}-${column.afterCol}`}
                          role="gridcell"
                          aria-label={t("vehicles.aisleAfterColumn", { column: column.afterCol, defaultValue: `Lối đi sau cột ${column.afterCol}` })}
                          className="flex min-h-16 items-center justify-center rounded-lg border-y border-dashed border-slate-200 text-slate-300"
                        >
                          <span className="h-full border-l border-dashed border-slate-300" aria-hidden="true" />
                        </div>
                      );
                    }

                    const seat = seatsByCoordinate.get(`${activeDeck}:${row}:${column.col}`);

                    if (!seat) {
                      return <div key={`empty-${row}-${column.col}`} role="gridcell" className="min-h-16 rounded-lg border border-dashed border-slate-200/80" aria-label={t("vehicles.emptyPosition", { row, col: column.col, defaultValue: "Vị trí trống" })} />;
                    }

                    const coordinateKey = getSeatCoordinateKey(seat);
                    const baselineSeat = baselineByCoordinate.get(coordinateKey);
                    const changed = Boolean(
                      baselineSeat && baselineSeat.disabled !== seat.disabled,
                    );
                    const canToggle = mode === "toggle-disabled" && isPassengerSeat(seat) && Boolean(onToggle);
                    const label = getSeatLabel(seat, t);
                    const className = `relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-vr-500/50 ${getSeatTone(seat)} ${
                      canToggle
                        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                        : ""
                    } ${changed ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${disabled ? "cursor-wait opacity-60" : ""}`;

                    if (canToggle) {
                      return (
                        <button
                          key={coordinateKey}
                          type="button"
                          role="gridcell"
                          className={className}
                          disabled={disabled}
                          aria-label={label}
                          aria-pressed={!seat.disabled}
                          title={label}
                          onClick={() => onToggle?.(seat.seatNumber)}
                        >
                          <SeatTypeIcon type={seat.type} />
                          <span>{seat.seatNumber}</span>
                          {seat.type === "SLEEPER_LOWER" || seat.type === "SLEEPER_UPPER" ? (
                            <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
                              {seat.type === "SLEEPER_UPPER" ? t("vehicles.upper", { defaultValue: "Trên" }) : t("vehicles.lower", { defaultValue: "Dưới" })}
                            </span>
                          ) : null}
                          {seat.disabled && <PiProhibit className="absolute right-1 top-1" aria-hidden="true" />}
                          {changed && <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={t("vehicles.changedSeat", { defaultValue: "Đã thay đổi" })} />}
                        </button>
                      );
                    }

                    return (
                      <div key={coordinateKey} role="gridcell" className={className} aria-label={label} title={label}>
                        <SeatTypeIcon type={seat.type} />
                        <span>{seat.seatNumber}</span>
                        {seat.type === "SLEEPER_LOWER" || seat.type === "SLEEPER_UPPER" ? (
                          <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
                            {seat.type === "SLEEPER_UPPER" ? t("vehicles.upper", { defaultValue: "Trên" }) : t("vehicles.lower", { defaultValue: "Dưới" })}
                          </span>
                        ) : null}
                        {seat.disabled && <PiProhibit className="absolute right-1 top-1" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
