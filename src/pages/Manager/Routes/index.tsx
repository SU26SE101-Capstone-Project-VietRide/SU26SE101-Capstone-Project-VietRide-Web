import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClock,
  FiGitBranch,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { routeCards, type RouteCard } from "../../../data/mockData";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [openConfig, setOpenConfig] = useState(false);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteCard | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("routes.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("routes.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenConfig(true)}
          className="inline-flex cursor-pointer shrink-0 items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-vr-600 hover:text-white"
        >
          <FiPlus size={18} />
          {t("routes.create")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {routeCards.map((r) => (
          <article
            key={r.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-vr-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">
                {r.code}
              </span>
              {r.status === "running" ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {t("routes.running")}
                </span>
              ) : (
                <span className="rounded-full bg-vr-50 px-2.5 py-0.5 text-xs font-semibold text-vr-900">
                  {t("routes.draft")}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">{r.title}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <FiMapPin className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {t("routes.stops")}
                </p>
                <p className="text-sm font-bold text-gray-900">{r.stops}</p>
              </div>
              <div>
                <FiClock className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {t("routes.duration")}
                </p>
                <p className="text-sm font-bold text-gray-900">{r.duration}</p>
              </div>
              <div>
                <FiGitBranch className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {t("routes.tripsPerWeek")}
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {r.tripsPerWeek}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">{r.distanceKm} km</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoute(r);
                    setOpenSchedule(true);
                  }}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  {t("routes.schedule")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoute(r);
                    setOpenConfig(true);
                  }}
                  className="font-medium text-vr-700 hover:text-vr-800"
                >
                  {t("routes.editRoute")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={openConfig}
        onClose={() => setOpenConfig(false)}
        wide
        icon={<FiNavigation size={20} />}
        title={t("routes.configTitle")}
        subtitle={t("routes.configSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenConfig(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("routes.saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => setOpenConfig(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("routes.publishRoute")}
            </button>
          </>
        }
      >
        <RouteConfigForm />
      </Modal>

      {/* Schedule Modal */}
      <Modal
        open={openSchedule}
        onClose={() => setOpenSchedule(false)}
        icon={<FiClock size={20} />}
        title={t("routes.scheduleTitle")}
        subtitle={t("routes.scheduleSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenSchedule(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenSchedule(false);
                alert(t("routes.scheduleCreated"));
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              {t("routes.createSchedule")}
            </button>
          </>
        }
      >
        {selectedRoute && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-semibold text-blue-900">
                {selectedRoute.title}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {selectedRoute.distanceKm} km · {selectedRoute.duration}
              </p>
            </div>

            <div>
              <label className={labelClass}>{t("routes.startDate")}</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{t("routes.endDate")}</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{t("routes.departureTime")}</label>
              <input type="time" className={inputClass} defaultValue="06:00" />
            </div>

            <div>
              <label className={labelClass}>{t("routes.weekdaysLabel")}</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {WEEKDAY_KEYS.map((key, idx) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={idx < 6}
                      className="rounded border-gray-300 text-vr-600"
                    />
                    <span className="text-sm text-gray-700">
                      {t(`routes.weekdays.${key}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("routes.frequency")}</label>
              <select className={inputClass} defaultValue="daily">
                <option value="daily">{t("routes.frequencyDaily")}</option>
                <option value="weekly">{t("routes.frequencyWeekly")}</option>
                <option value="biweekly">
                  {t("routes.frequencyBiweekly")}
                </option>
              </select>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">
                  {t("routes.scheduleSummary")}
                </span>{" "}
                {t("routes.scheduleSummaryText")}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const defaultStops = [
  { id: "1", name: "Bến xe Miền Tây, HCM", meta: "0 km · 00:00" },
  { id: "2", name: "Trạm Long Khánh", meta: "75 km · 01:15" },
  { id: "3", name: "TP Bảo Lộc", meta: "190 km · 04:30" },
  { id: "4", name: "Bến xe Đà Lạt", meta: "308 km · 07:30" },
];

function RouteConfigForm() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-bold text-gray-900">
          {t("routes.routeInfo")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              {t("routes.routeCode")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="R-DL01" />
          </div>
          <div>
            <label className={labelClass}>
              {t("routes.routeName")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="HCM → Đà Lạt" />
          </div>
          <div>
            <label className={labelClass}>
              {t("routes.origin")} <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="TP. Hồ Chí Minh" />
          </div>
          <div>
            <label className={labelClass}>
              {t("routes.destination")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="Đà Lạt" />
          </div>
          <div>
            <label className={labelClass}>{t("routes.totalDistance")}</label>
            <input className={inputClass} defaultValue="308" />
          </div>
          <div>
            <label className={labelClass}>
              {t("routes.estimatedDuration")}
            </label>
            <input className={inputClass} defaultValue="7h 30m" />
          </div>
        </div>
      </section>
      <div className="border-t border-gray-100" />
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {t("routes.stopsAlongRoute")}
            </h3>
            <p className="text-xs text-gray-500">{t("routes.dragToReorder")}</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FiPlus size={16} />
            {t("routes.addStop")}
          </button>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2">
          {defaultStops.map((row, i) => (
            <div
              key={row.id}
              className="mb-2 flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2 last:mb-0"
            >
              <span className="cursor-grab px-1 text-gray-400">⋮⋮</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vr-100 text-xs font-bold text-vr-800">
                {i + 1}
              </span>
              <input
                className={inputClass + " flex-1"}
                defaultValue={row.name}
              />
              <input
                className={inputClass + " w-36 shrink-0"}
                defaultValue={row.meta}
              />
              <button
                type="button"
                className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                aria-label={tc("delete")}
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
