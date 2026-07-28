import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiLock, FiSave, FiSlash } from "react-icons/fi";
import { getOperatorVehicles, updateOperatorVehicle, type OperatorVehicle, type SeatLayoutJson } from "../../../api/vietride";
import { getAuthUser } from "../../../auth";

type SeatStatus = "AVAILABLE" | "BOOKED" | "UNAVAILABLE";
type SeatAvailability = { seatNumber: string; status: SeatStatus; reason?: string };
type TripCapacity = {
  id: string; code: string; routeName: string; vehiclePlate: string; departureTime: string;
  maxCargoWeightKg: number; maxCargoVolumeM3: number; bookedCargoWeightKg: number;
  bookedCargoVolumeM3: number; seats: SeatAvailability[];
};
type AlertState = { tone: "success" | "error"; message: string };

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:bg-gray-300";
const vehicleId = (vehicle: OperatorVehicle) => vehicle.id ?? vehicle.vehicleId ?? "";

function parseLayout(vehicle: OperatorVehicle): SeatLayoutJson | null {
  if (!vehicle.seatLayoutJson) return null;
  if (typeof vehicle.seatLayoutJson !== "string") return vehicle.seatLayoutJson;
  try { return JSON.parse(vehicle.seatLayoutJson) as SeatLayoutJson; } catch { return null; }
}
function toCapacity(vehicle: OperatorVehicle): TripCapacity {
  const layout = parseLayout(vehicle);
  return {
    id: vehicleId(vehicle), code: vehicle.licensePlate,
    routeName: vehicle.vehicleTypeName ?? vehicle.vehicleTypeCode ?? "Phương tiện nhà xe",
    vehiclePlate: `${vehicle.totalSeats} ghế`, departureTime: vehicle.status,
    maxCargoWeightKg: vehicle.maxCargoWeightKg ?? 0, maxCargoVolumeM3: vehicle.maxCargoVolumeM3 ?? 0,
    bookedCargoWeightKg: 0, bookedCargoVolumeM3: 0,
    seats: (layout?.seats ?? []).map((seat) => ({
      seatNumber: seat.seatNumber, status: seat.disabled ? "UNAVAILABLE" : "AVAILABLE",
      reason: typeof seat.metadata?.disableReason === "string" ? seat.metadata.disableReason : undefined,
    })),
  };
}
function formatNumber(value: number) { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value); }
function seatClass(status: SeatStatus, selected: boolean) {
  const ring = selected ? "ring-2 ring-vr-500 ring-offset-2" : "";
  if (status === "BOOKED") return `${ring} border-rose-200 bg-rose-50 text-rose-700`;
  if (status === "UNAVAILABLE") return `${ring} border-slate-200 bg-slate-100 text-slate-500`;
  return `${ring} border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100`;
}

export default function CapacityPage() {
  const { t } = useTranslation("manager");
  const canEdit = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [trips, setTrips] = useState<TripCapacity[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [volumeInput, setVolumeInput] = useState("");
  const [reason, setReason] = useState("");
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    void getOperatorVehicles({ page: 1, pageSize: 100 }).then((result) => {
      if (ignore) return;
      const mapped = result.items.map(toCapacity);
      setVehicles(result.items); setTrips(mapped);
      const first = mapped[0];
      if (first) {
        setSelectedTripId(first.id); setSelectedSeatNumber(first.seats[0]?.seatNumber ?? "");
        setWeightInput(String(first.maxCargoWeightKg)); setVolumeInput(String(first.maxCargoVolumeM3));
      }
    }).catch((error: unknown) => {
      if (!ignore) setAlert({ tone: "error", message: error instanceof Error ? error.message : "Không thể tải dữ liệu sức chứa." });
    }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId) ?? trips[0], [selectedTripId, trips]);
  const selectedSeat = selectedTrip?.seats.find((seat) => seat.seatNumber === selectedSeatNumber);
  const availableSeats = selectedTrip?.seats.filter((seat) => seat.status === "AVAILABLE").length ?? 0;
  const disabledSeats = selectedTrip?.seats.filter((seat) => seat.status === "UNAVAILABLE").length ?? 0;
  const cargoWeightPct = 0;
  const cargoVolumePct = 0;

  function selectTrip(id: string) {
    const item = trips.find((trip) => trip.id === id); if (!item) return;
    setSelectedTripId(id); setSelectedSeatNumber(item.seats[0]?.seatNumber ?? "");
    setWeightInput(String(item.maxCargoWeightKg)); setVolumeInput(String(item.maxCargoVolumeM3)); setReason(""); setAlert(null);
  }

  async function persist(next: TripCapacity, successMessage: string) {
    const vehicle = vehicles.find((item) => vehicleId(item) === next.id);
    const layout = vehicle ? parseLayout(vehicle) : null;
    if (!vehicle || !layout) { setAlert({ tone: "error", message: "Phương tiện chưa có sơ đồ ghế hợp lệ." }); return; }
    setSaving(true); setAlert(null);
    try {
      const updated = await updateOperatorVehicle(next.id, {
        vehicleTypeId: vehicle.vehicleTypeId, licensePlate: vehicle.licensePlate,
        totalSeats: layout.seats.length, maxCargoWeightKg: next.maxCargoWeightKg,
        maxCargoVolumeM3: next.maxCargoVolumeM3, imageUrls: vehicle.imageUrls ?? [],
        seatLayoutJson: { ...layout, seats: layout.seats.map((seat) => {
          const state = next.seats.find((item) => item.seatNumber === seat.seatNumber);
          return { ...seat, disabled: state?.status === "UNAVAILABLE", metadata: state?.reason ? { ...seat.metadata, disableReason: state.reason } : seat.metadata };
        }) },
      });
      setVehicles((items) => items.map((item) => vehicleId(item) === next.id ? updated : item));
      setTrips((items) => items.map((item) => item.id === next.id ? toCapacity(updated) : item));
      setAlert({ tone: "success", message: successMessage });
    } catch (error) { setAlert({ tone: "error", message: error instanceof Error ? error.message : "Không thể cập nhật phương tiện." }); }
    finally { setSaving(false); }
  }

  async function saveCapacity() {
    if (!selectedTrip || !canEdit) return;
    const nextWeight = Number(weightInput); const nextVolume = Number(volumeInput);
    if (!Number.isFinite(nextWeight) || !Number.isFinite(nextVolume) || nextWeight < 0 || nextVolume < 0) { setAlert({ tone: "error", message: t("capacity.invalidCapacity") }); return; }
    await persist({ ...selectedTrip, maxCargoWeightKg: nextWeight, maxCargoVolumeM3: nextVolume }, `Đã cập nhật sức chứa cho xe ${selectedTrip.code}.`);
  }
  async function disableSeat() {
    if (!selectedTrip || !selectedSeat || !canEdit) return;
    if (!reason.trim()) { setAlert({ tone: "error", message: t("capacity.reasonRequired") }); return; }
    const next = { ...selectedTrip, seats: selectedTrip.seats.map((seat) => seat.seatNumber === selectedSeat.seatNumber ? { ...seat, status: "UNAVAILABLE" as const, reason: reason.trim() } : seat) };
    await persist(next, t("capacity.seatDisabled", { seat: selectedSeat.seatNumber }));
  }
  async function enableSeat() {
    if (!selectedTrip || !selectedSeat || !canEdit) return;
    const next = { ...selectedTrip, seats: selectedTrip.seats.map((seat) => seat.seatNumber === selectedSeat.seatNumber ? { seatNumber: seat.seatNumber, status: "AVAILABLE" as const } : seat) };
    setReason(""); await persist(next, t("capacity.seatEnabled", { seat: selectedSeat.seatNumber }));
  }
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-vr-600">
              {t("capacity.section")}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {t("capacity.title")}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              {t("capacity.subtitle")}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">
              {t("capacity.activeTrips")}
            </h2>
            <div className="mt-4 space-y-2">
              {loading && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Đang tải dữ liệu...
                </p>
              )}
              {!loading && trips.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Chưa có phương tiện.
                </p>
              )}
              {trips.map((trip) => (                <button
                  key={trip.id}
                  type="button"
                  onClick={() => selectTrip(trip.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedTrip?.id === trip.id
                      ? "border-vr-300 bg-vr-50"
                      : "border-gray-100 bg-white hover:border-vr-200 hover:bg-vr-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {trip.code}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {trip.routeName}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {trip.vehiclePlate}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {trip.departureTime}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">
              {t("capacity.businessRules")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>{t("capacity.rulePositive")}</li>
              <li>{t("capacity.ruleSeatExists")}</li>
              <li>{t("capacity.ruleReasonRequired")}</li>
              <li>{t("capacity.ruleNoManualSale")}</li>
            </ul>
          </div>
        </aside>

        {selectedTrip && (
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">
                  {t("capacity.availableSeats")}
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-600">
                  {availableSeats}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">
                  {t("capacity.disabledSeats")}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-700">
                  {disabledSeats}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">
                  {t("capacity.remainingCargo")}
                </p>
                <p className="mt-2 text-2xl font-bold text-vr-700">
                  {formatNumber(
                    selectedTrip.maxCargoWeightKg -
                      selectedTrip.bookedCargoWeightKg,
                  )}
                  kg
                </p>
              </div>
            </section>

            {alert && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  alert.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {alert.message}
              </div>
            )}

            <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  {t("capacity.capacityConfig")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("capacity.capacityConfigHint")}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>
                      {t("capacity.maxCargoWeight")}
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={weightInput}
                      onChange={(event) => setWeightInput(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>
                      {t("capacity.maxCargoVolume")}
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      step="0.1"
                      value={volumeInput}
                      onChange={(event) => setVolumeInput(event.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{t("capacity.bookedCargo")}</span>
                      <span>
                        {formatNumber(selectedTrip.bookedCargoWeightKg)} /{" "}
                        {formatNumber(selectedTrip.maxCargoWeightKg)}kg
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-vr-500"
                        style={{ width: `${cargoWeightPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{t("capacity.tripCargo")}</span>
                      <span>
                        {formatNumber(selectedTrip.bookedCargoVolumeM3)} /{" "}
                        {formatNumber(selectedTrip.maxCargoVolumeM3)}m3
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-500"
                        style={{ width: `${cargoVolumePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`${primaryButtonClass} mt-6 w-full`}
                  onClick={saveCapacity}
                  disabled={!canEdit || saving}
                >
                  <FiSave />
                  {t("capacity.saveCapacity")}
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  {t("capacity.seatAvailability")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("capacity.seatAvailabilityHint")}
                </p>

                <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {selectedTrip.seats.map((seat) => (
                    <button
                      key={seat.seatNumber}
                      type="button"
                      onClick={() => {
                        setSelectedSeatNumber(seat.seatNumber);
                        setReason(seat.reason ?? "");
                        setAlert(null);
                      }}
                      className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-bold transition ${seatClass(
                        seat.status,
                        selectedSeatNumber === seat.seatNumber,
                      )}`}
                      title={seat.reason}
                    >
                      {seat.status === "BOOKED" && <FiLock className="mb-1" />}
                      {seat.status === "UNAVAILABLE" && (
                        <FiSlash className="mb-1" />
                      )}
                      {seat.status === "AVAILABLE" && (
                        <FiCheck className="mb-1" />
                      )}
                      {seat.seatNumber}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    {t("capacity.available")}
                  </span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                    {t("capacity.booked")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {t("capacity.disabled")}
                  </span>
                </div>

                <div className="mt-5 rounded-lg border border-gray-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {t("capacity.selectedSeat")}:{" "}
                    {selectedSeat?.seatNumber ?? "-"}
                  </p>
                  {selectedSeat?.reason && (
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedSeat.reason}
                    </p>
                  )}
                  <label className="mt-4 block">
                    <span className={labelClass}>
                      {t("capacity.disableReason")}
                    </span>
                    <textarea
                      className={`${inputClass} min-h-24 resize-none`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={t("capacity.disableReasonPlaceholder")}
                    />
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={disableSeat}
                      disabled={!canEdit || saving}
                    >
                      <FiSlash />
                      {t("capacity.disableSeat")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={enableSeat}
                      disabled={!canEdit || saving}
                    >
                      <FiCheck />
                      {t("capacity.enableSeat")}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
