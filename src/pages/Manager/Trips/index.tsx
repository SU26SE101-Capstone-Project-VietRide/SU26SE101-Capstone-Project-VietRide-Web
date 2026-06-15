import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiTruck,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiList,
  FiMoreVertical,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { managerTrips, type ManagerTripStatus } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type TripTab = "all" | "running" | "upcoming" | "completed" | "cancelled";

function formatDepart(iso: string) {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${t} ${day}/${month}`;
}

function tripStatusBadge(
  s: ManagerTripStatus,
  t: (key: string) => string,
) {
  const styles: Record<
    ManagerTripStatus,
    { className: string; labelKey: string }
  > = {
    running: {
      className: "bg-sky-50 text-sky-800",
      labelKey: "trips.running",
    },
    departed: {
      className: "bg-vr-50 text-vr-900",
      labelKey: "trips.departed",
    },
    upcoming: {
      className: "bg-amber-50 text-amber-800",
      labelKey: "trips.upcoming",
    },
    cancelled: {
      className: "bg-red-50 text-red-800",
      labelKey: "trips.cancelled",
    },
    completed: {
      className: "bg-emerald-50 text-emerald-800",
      labelKey: "trips.completed",
    },
  };
  const x = styles[s];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {t(x.labelKey)}
    </span>
  );
}

export default function TripsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TripTab>("all");
  const [openCreate, setOpenCreate] = useState(false);

  const counts = useMemo(() => {
    const c = {
      all: managerTrips.length,
      running: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const trip of managerTrips) {
      if (trip.status === "running" || trip.status === "departed") c.running++;
      if (trip.status === "upcoming") c.upcoming++;
      if (trip.status === "completed") c.completed++;
      if (trip.status === "cancelled") c.cancelled++;
    }
    return c;
  }, []);

  const filtered = useMemo(() => {
    return managerTrips.filter((trip) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        trip.code.toLowerCase().includes(q) ||
        trip.route.toLowerCase().includes(q) ||
        trip.vehiclePlate.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (tab === "all") return true;
      if (tab === "running")
        return trip.status === "running" || trip.status === "departed";
      return trip.status === tab;
    });
  }, [search, tab]);

  const tabs: { key: TripTab; labelKey: string }[] = [
    { key: "all", labelKey: "trips.tabAll" },
    { key: "running", labelKey: "trips.tabRunning" },
    { key: "upcoming", labelKey: "trips.tabUpcoming" },
    { key: "completed", labelKey: "trips.tabCompleted" },
    { key: "cancelled", labelKey: "trips.tabCancelled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("trips.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("trips.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("trips.create")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "border-gray-300 bg-gray-100 text-gray-900"
                : "border-transparent bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("trips.tabWithCount", {
              label: t(labelKey),
              count: counts[key],
            })}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder={t("trips.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiFilter size={16} />
              {tc("filter")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiList size={16} />
              {tc("columns")}
            </button>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:ml-0"
            >
              <FiDownload size={16} />
              {tc("exportCsv")}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3">{t("trips.tripCode")}</th>
                <th className="px-4 py-3">{t("trips.route")}</th>
                <th className="px-4 py-3">{t("trips.departure")}</th>
                <th className="px-4 py-3">{t("trips.driver")}</th>
                <th className="px-4 py-3">{t("trips.vehicle")}</th>
                <th className="px-4 py-3">{t("trips.seats")}</th>
                <th className="px-4 py-3">{tc("status")}</th>
                <th className="px-4 py-3 text-center"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip) => (
                <tr
                  key={trip.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className="text-sm font-semibold text-vr-700 hover:underline"
                    >
                      {trip.code}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-800">
                    {trip.route}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {formatDepart(trip.departAt)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.driver}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    {trip.vehiclePlate}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.seatsTotal > 0
                      ? `${trip.seatsSold}/${trip.seatsTotal}`
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    {tripStatusBadge(trip.status, t)}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-400">
                    <button type="button" className="p-1 hover:text-gray-700">
                      <FiMoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {tc("showingItems", {
              count: filtered.length,
              total: managerTrips.length,
            })}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <FiChevronLeft className="inline" /> {tc("previous")}
            </button>
            <button
              type="button"
              className="rounded-lg bg-vr-500 px-3 py-1.5 text-sm font-semibold text-slate-900"
            >
              1
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              2
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              3
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {tc("next")} <FiChevronRight className="inline" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        wide
        icon={<FiTruck size={20} />}
        title={t("trips.createTitle")}
        subtitle={t("trips.createSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("trips.saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("trips.openForSale")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("trips.sectionRouteSchedule")}
            </h3>
            <div className="mb-4">
              <label className={labelClass}>
                {t("trips.route")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} defaultValue="">
                <option value="">{t("trips.selectRoute")}</option>
                <option>HCM → Đà Lạt</option>
                <option>HCM → Nha Trang</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("trips.departureDate")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("trips.departureTime")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="time" />
              </div>
              <div>
                <label className={labelClass}>{t("trips.pickupPoint")}</label>
                <select className={inputClass} defaultValue="west">
                  <option value="west">Bến xe Miền Tây</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("trips.dropoffPoint")}</label>
                <select className={inputClass} defaultValue="dl">
                  <option value="dl">Bến xe Đà Lạt</option>
                </select>
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("trips.sectionVehicleStaff")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("trips.vehicle")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="">
                  <option value="">{t("trips.selectVehicle")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {t("trips.mainDriver")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="">
                  <option value="">{t("trips.selectDriver")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("trips.coDriver")}</label>
                <select className={inputClass} defaultValue="">
                  <option value="">{t("trips.optionalInParens")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("trips.attendant")}</label>
                <input
                  className={inputClass}
                  placeholder={t("trips.fullNamePlaceholder")}
                />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("trips.sectionPricing")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("trips.ticketPrice")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="320000" />
              </div>
              <div>
                <label className={labelClass}>{t("trips.seatsForSale")}</label>
                <input className={inputClass} defaultValue="40" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("trips.cargoCapacityKg")}
                </label>
                <input className={inputClass} defaultValue="500" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("trips.cargoRatePerKg")}
                </label>
                <input className={inputClass} defaultValue="8000" />
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
