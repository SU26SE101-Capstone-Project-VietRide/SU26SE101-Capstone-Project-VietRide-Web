import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiLock, FiSave, FiSlash } from "react-icons/fi";

type SeatStatus = "AVAILABLE" | "BOOKED" | "UNAVAILABLE";

type SeatAvailability = {
  seatNumber: string;
  status: SeatStatus;
  reason?: string;
};

type TripCapacity = {
  id: string;
  code: string;
  routeName: string;
  vehiclePlate: string;
  departureTime: string;
  maxCargoWeightKg: number;
  maxCargoVolumeM3: number;
  bookedCargoWeightKg: number;
  bookedCargoVolumeM3: number;
  seats: SeatAvailability[];
};

type AlertState = {
  tone: "success" | "error";
  message: string;
};

const initialTrips: TripCapacity[] = [
  {
    id: "trip-sgn-dlt-0700",
    code: "TRP-0700-SGN-DLT",
    routeName: "Ho Chi Minh City - Da Lat",
    vehiclePlate: "51B-220.11",
    departureTime: "2026-07-02 07:00",
    maxCargoWeightKg: 380,
    maxCargoVolumeM3: 8.5,
    bookedCargoWeightKg: 214,
    bookedCargoVolumeM3: 4.6,
    seats: [
      { seatNumber: "A1", status: "BOOKED" },
      { seatNumber: "A2", status: "AVAILABLE" },
      { seatNumber: "A3", status: "AVAILABLE" },
      {
        seatNumber: "A4",
        status: "UNAVAILABLE",
        reason: "Seat belt maintenance",
      },
      { seatNumber: "B1", status: "AVAILABLE" },
      { seatNumber: "B2", status: "BOOKED" },
      { seatNumber: "B3", status: "AVAILABLE" },
      { seatNumber: "B4", status: "AVAILABLE" },
      { seatNumber: "C1", status: "AVAILABLE" },
      { seatNumber: "C2", status: "AVAILABLE" },
      { seatNumber: "C3", status: "BOOKED" },
      { seatNumber: "C4", status: "AVAILABLE" },
    ],
  },
  {
    id: "trip-sgn-vtg-0930",
    code: "TRP-0930-SGN-VTG",
    routeName: "Ho Chi Minh City - Vung Tau",
    vehiclePlate: "51B-889.91",
    departureTime: "2026-07-02 09:30",
    maxCargoWeightKg: 260,
    maxCargoVolumeM3: 5.2,
    bookedCargoWeightKg: 146,
    bookedCargoVolumeM3: 2.8,
    seats: [
      { seatNumber: "A1", status: "AVAILABLE" },
      { seatNumber: "A2", status: "AVAILABLE" },
      { seatNumber: "A3", status: "BOOKED" },
      { seatNumber: "A4", status: "AVAILABLE" },
      {
        seatNumber: "B1",
        status: "UNAVAILABLE",
        reason: "Reserved for accessibility support",
      },
      { seatNumber: "B2", status: "AVAILABLE" },
      { seatNumber: "B3", status: "BOOKED" },
      { seatNumber: "B4", status: "AVAILABLE" },
    ],
  },
  {
    id: "trip-hni-hpg-1400",
    code: "TRP-1400-HNI-HPG",
    routeName: "Ha Noi - Hai Phong",
    vehiclePlate: "29F-120.09",
    departureTime: "2026-07-02 14:00",
    maxCargoWeightKg: 320,
    maxCargoVolumeM3: 6.4,
    bookedCargoWeightKg: 88,
    bookedCargoVolumeM3: 1.7,
    seats: [
      { seatNumber: "A1", status: "AVAILABLE" },
      { seatNumber: "A2", status: "AVAILABLE" },
      { seatNumber: "A3", status: "AVAILABLE" },
      { seatNumber: "A4", status: "AVAILABLE" },
      { seatNumber: "B1", status: "BOOKED" },
      { seatNumber: "B2", status: "AVAILABLE" },
      { seatNumber: "B3", status: "AVAILABLE" },
      { seatNumber: "B4", status: "UNAVAILABLE", reason: "Window repair" },
    ],
  },
];

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:bg-gray-300";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function seatClass(status: SeatStatus, selected: boolean) {
  const selectedClass = selected ? "ring-2 ring-vr-500 ring-offset-2" : "";

  if (status === "BOOKED") {
    return `${selectedClass} border-rose-200 bg-rose-50 text-rose-700`;
  }

  if (status === "UNAVAILABLE") {
    return `${selectedClass} border-slate-200 bg-slate-100 text-slate-500`;
  }

  return `${selectedClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100`;
}

export default function CapacityPage() {
  const { t } = useTranslation("manager");
  const [trips, setTrips] = useState<TripCapacity[]>(initialTrips);
  const [selectedTripId, setSelectedTripId] = useState(
    initialTrips[0]?.id ?? "",
  );
  const [selectedSeatNumber, setSelectedSeatNumber] = useState(
    initialTrips[0]?.seats[0]?.seatNumber ?? "",
  );
  const [weightInput, setWeightInput] = useState(
    String(initialTrips[0]?.maxCargoWeightKg ?? ""),
  );
  const [volumeInput, setVolumeInput] = useState(
    String(initialTrips[0]?.maxCargoVolumeM3 ?? ""),
  );
  const [reason, setReason] = useState("");
  const [alert, setAlert] = useState<AlertState | null>(null);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0],
    [selectedTripId, trips],
  );

  const selectedSeat = selectedTrip?.seats.find(
    (seat) => seat.seatNumber === selectedSeatNumber,
  );

  const availableSeats =
    selectedTrip?.seats.filter((seat) => seat.status === "AVAILABLE").length ??
    0;
  const disabledSeats =
    selectedTrip?.seats.filter((seat) => seat.status === "UNAVAILABLE")
      .length ?? 0;
  const cargoWeightPct = selectedTrip
    ? Math.min(
        (selectedTrip.bookedCargoWeightKg / selectedTrip.maxCargoWeightKg) *
          100,
        100,
      )
    : 0;
  const cargoVolumePct = selectedTrip
    ? Math.min(
        (selectedTrip.bookedCargoVolumeM3 / selectedTrip.maxCargoVolumeM3) *
          100,
        100,
      )
    : 0;

  const selectTrip = (tripId: string) => {
    const trip = trips.find((item) => item.id === tripId);
    if (!trip) {
      return;
    }

    setSelectedTripId(trip.id);
    setSelectedSeatNumber(trip.seats[0]?.seatNumber ?? "");
    setWeightInput(String(trip.maxCargoWeightKg));
    setVolumeInput(String(trip.maxCargoVolumeM3));
    setReason("");
    setAlert(null);
  };

  const saveCapacity = () => {
    if (!selectedTrip) {
      return;
    }

    const nextWeight = Number(weightInput);
    const nextVolume = Number(volumeInput);

    if (
      !Number.isFinite(nextWeight) ||
      !Number.isFinite(nextVolume) ||
      nextWeight <= 0 ||
      nextVolume <= 0
    ) {
      setAlert({ tone: "error", message: t("capacity.invalidCapacity") });
      return;
    }

    if (
      nextWeight < selectedTrip.bookedCargoWeightKg ||
      nextVolume < selectedTrip.bookedCargoVolumeM3
    ) {
      setAlert({ tone: "error", message: t("capacity.capacityBelowBooked") });
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.id === selectedTrip.id
          ? {
              ...trip,
              maxCargoWeightKg: nextWeight,
              maxCargoVolumeM3: nextVolume,
            }
          : trip,
      ),
    );
    setAlert({
      tone: "success",
      message: t("capacity.capacityUpdated", { trip: selectedTrip.code }),
    });
  };

  const disableSeat = () => {
    if (!selectedTrip || !selectedSeat) {
      setAlert({ tone: "error", message: t("capacity.selectSeatRequired") });
      return;
    }

    if (selectedSeat.status === "BOOKED") {
      setAlert({ tone: "error", message: t("capacity.seatBooked") });
      return;
    }

    if (selectedSeat.status === "UNAVAILABLE") {
      setAlert({ tone: "error", message: t("capacity.seatAlreadyDisabled") });
      return;
    }

    if (!reason.trim()) {
      setAlert({ tone: "error", message: t("capacity.reasonRequired") });
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.id === selectedTrip.id
          ? {
              ...trip,
              seats: trip.seats.map((seat) =>
                seat.seatNumber === selectedSeat.seatNumber
                  ? { ...seat, status: "UNAVAILABLE", reason: reason.trim() }
                  : seat,
              ),
            }
          : trip,
      ),
    );
    setAlert({
      tone: "success",
      message: t("capacity.seatDisabled", { seat: selectedSeat.seatNumber }),
    });
  };

  const enableSeat = () => {
    if (!selectedTrip || !selectedSeat) {
      setAlert({ tone: "error", message: t("capacity.selectSeatRequired") });
      return;
    }

    if (selectedSeat.status !== "UNAVAILABLE") {
      setAlert({ tone: "error", message: t("capacity.seatNotDisabled") });
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.id === selectedTrip.id
          ? {
              ...trip,
              seats: trip.seats.map((seat) =>
                seat.seatNumber === selectedSeat.seatNumber
                  ? { seatNumber: seat.seatNumber, status: "AVAILABLE" }
                  : seat,
              ),
            }
          : trip,
      ),
    );
    setReason("");
    setAlert({
      tone: "success",
      message: t("capacity.seatEnabled", { seat: selectedSeat.seatNumber }),
    });
  };

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
              {trips.map((trip) => (
                <button
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
                    >
                      <FiSlash />
                      {t("capacity.disableSeat")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={enableSeat}
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
