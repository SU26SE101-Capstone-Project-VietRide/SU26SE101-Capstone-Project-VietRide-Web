import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiFilter,
  FiList,
  FiLock,
  FiSearch,
  FiTruck,
  FiUnlock,
} from "react-icons/fi";
import {
  bookInternalTripSeats,
  getInternalTrip,
  getPublicTrip,
  getPublicTripSeatMap,
  lockInternalRoundTripSeats,
  lockInternalTripSeats,
  releaseInternalTripSeats,
  searchPublicTrips,
  type PublicTrip,
  type RoundTripSeatLockResult,
  type SeatLockResult,
} from "../../../api/vietride";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function asJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TripsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [originStationId, setOriginStationId] = useState("");
  const [destinationStationId, setDestinationStationId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [allowAlongRoutePickup, setAllowAlongRoutePickup] = useState(false);
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [tripDetail, setTripDetail] = useState<PublicTrip | null>(null);
  const [seatMapJson, setSeatMapJson] = useState("");
  const [internalTripJson, setInternalTripJson] = useState("");
  const [seatNumbers, setSeatNumbers] = useState("");
  const [holdOwnerId, setHoldOwnerId] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState("300");
  const [seatLockToken, setSeatLockToken] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [returnTripId, setReturnTripId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [lockResult, setLockResult] = useState<SeatLockResult | null>(null);
  const [roundTripLockResult, setRoundTripLockResult] =
    useState<RoundTripSeatLockResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runSafely(action: () => Promise<void>) {
    setError("");
    setMessage("");

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function handleSearchTrips() {
    await runSafely(async () => {
      const result = await searchPublicTrips({
        originStationId,
        destinationStationId,
        departureDate,
        passengerCount: Number(passengerCount),
        allowAlongRoutePickup,
      });
      setTrips(result);
      setSelectedTripId(result[0]?.tripId || "");
      setMessage("Trip search completed.");
    });
  }

  async function handleGetTripDetail() {
    await runSafely(async () => {
      const detail = await getPublicTrip(selectedTripId);
      setTripDetail(detail);
      setMessage("Trip detail loaded.");
    });
  }

  async function handleGetSeatMap() {
    await runSafely(async () => {
      const seatMap = await getPublicTripSeatMap(selectedTripId);
      setSeatMapJson(asJson(seatMap));
      setMessage("Seat map loaded.");
    });
  }

  async function handleGetInternalTrip() {
    await runSafely(async () => {
      const trip = await getInternalTrip(selectedTripId);
      setInternalTripJson(asJson(trip));
      setMessage("Internal trip loaded.");
    });
  }

  async function handleLockSeats() {
    await runSafely(async () => {
      const result = await lockInternalTripSeats(selectedTripId, {
        seatNumbers: splitCsv(seatNumbers),
        holdOwnerId,
        ttlSeconds: Number(ttlSeconds),
      });
      setLockResult(result);
      setSeatLockToken(result.seatLockToken);
      setMessage("Seats locked.");
    });
  }

  async function handleReleaseSeats() {
    await runSafely(async () => {
      await releaseInternalTripSeats(selectedTripId, {
        seatLockToken,
        seatNumbers: splitCsv(seatNumbers),
      });
      setMessage("Seats released.");
    });
  }

  async function handleBookSeats() {
    await runSafely(async () => {
      const seatList = splitCsv(seatNumbers);
      await bookInternalTripSeats(selectedTripId, {
        seatLockToken,
        bookingId,
        passengers: seatList.map((seatNumber, index) => ({
          passengerId: index === 0 ? passengerId : `${passengerId}-${index + 1}`,
          seatNumber,
        })),
      });
      setMessage("Seats booked.");
    });
  }

  async function handleRoundTripLock() {
    await runSafely(async () => {
      const result = await lockInternalRoundTripSeats(
        {
          outbound: {
            tripId: selectedTripId,
            seatNumbers: splitCsv(seatNumbers),
          },
          return: {
            tripId: returnTripId,
            seatNumbers: splitCsv(seatNumbers),
          },
          holdOwnerId,
          ttlSeconds: Number(ttlSeconds),
        },
        idempotencyKey || undefined,
      );
      setRoundTripLockResult(result);
      setMessage("Round-trip seats locked.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("trips.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Public trip search/detail/seat-map and internal seat operations are wired.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Public trip search</h2>
          <FiSearch className="text-gray-400" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Origin station ID" value={originStationId} onChange={setOriginStationId} />
          <Input label="Destination station ID" value={destinationStationId} onChange={setDestinationStationId} />
          <Input label="Departure date" value={departureDate} onChange={setDepartureDate} type="date" />
          <Input label="Passenger count" value={passengerCount} onChange={setPassengerCount} type="number" />
          <label className="flex items-end gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowAlongRoutePickup}
              onChange={(event) => setAllowAlongRoutePickup(event.target.checked)}
            />
            Allow along-route pickup
          </label>
          <button
            type="button"
            onClick={handleSearchTrips}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiSearch size={16} />
            Search trips
          </button>
        </div>
      </section>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <select
            className={inputClass + " flex-1"}
            value={selectedTripId}
            onChange={(event) => setSelectedTripId(event.target.value)}
          >
            <option value="">Select trip</option>
            {trips.map((trip) => (
              <option key={trip.tripId} value={trip.tripId}>
                {trip.tripId} - {trip.status} - {trip.baseFare.toLocaleString("vi-VN")} VND
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton icon={<FiFilter size={16} />} label={tc("filter")} />
            <ToolbarButton icon={<FiList size={16} />} label={tc("columns")} />
            <ToolbarButton icon={<FiDownload size={16} />} label={tc("exportCsv")} />
            <button
              type="button"
              onClick={handleGetTripDetail}
              disabled={!selectedTripId}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Detail
            </button>
            <button
              type="button"
              onClick={handleGetSeatMap}
              disabled={!selectedTripId}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Seat map
            </button>
            <button
              type="button"
              onClick={handleGetInternalTrip}
              disabled={!selectedTripId}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Internal trip
            </button>
          </div>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Departure</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3">Fare</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr
                  key={trip.tripId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-4 text-sm font-semibold text-vr-700">
                    {trip.tripId}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.departureTime}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.estimatedArrivalTime}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.baseFare.toLocaleString("vi-VN")} VND
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Trip payloads</h2>
          <div className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
            <pre>
              {asJson({
                tripDetail,
                seatMap: seatMapJson ? JSON.parse(seatMapJson) : null,
                internalTrip: internalTripJson ? JSON.parse(internalTripJson) : null,
              })}
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FiTruck className="text-vr-600" />
          <h2 className="text-lg font-bold text-gray-900">
            Internal seat operations
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Seat numbers CSV" value={seatNumbers} onChange={setSeatNumbers} placeholder="A1,A2" />
          <Input label="Hold owner ID" value={holdOwnerId} onChange={setHoldOwnerId} />
          <Input label="TTL seconds" value={ttlSeconds} onChange={setTtlSeconds} type="number" />
          <Input label="Seat lock token" value={seatLockToken} onChange={setSeatLockToken} />
          <Input label="Booking ID" value={bookingId} onChange={setBookingId} />
          <Input label="Passenger ID" value={passengerId} onChange={setPassengerId} />
          <Input label="Return trip ID" value={returnTripId} onChange={setReturnTripId} />
          <Input label="Idempotency-Key" value={idempotencyKey} onChange={setIdempotencyKey} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLockSeats}
            disabled={!selectedTripId}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
          >
            <FiLock size={16} />
            Lock seats
          </button>
          <button
            type="button"
            onClick={handleReleaseSeats}
            disabled={!selectedTripId || !seatLockToken}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FiUnlock size={16} />
            Release seats
          </button>
          <button
            type="button"
            onClick={handleBookSeats}
            disabled={!selectedTripId || !seatLockToken || !bookingId}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Book seats
          </button>
          <button
            type="button"
            onClick={handleRoundTripLock}
            disabled={!selectedTripId || !returnTripId}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Lock round trip
          </button>
        </div>
        {(lockResult || roundTripLockResult) && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
            {asJson({ lockResult, roundTripLockResult })}
          </pre>
        )}
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ToolbarButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {icon}
      {label}
    </button>
  );
}
