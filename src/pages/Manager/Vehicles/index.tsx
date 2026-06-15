import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { fleetVehicles, type FleetVehicle } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function VehiclesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openMaint, setOpenMaint] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);

  const filtered = useMemo(
    () =>
      fleetVehicles.filter(
        (v) =>
          v.plate.toLowerCase().includes(search.toLowerCase()) ||
          (v.driver && v.driver.toLowerCase().includes(search.toLowerCase())) ||
          v.model.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const total = 312;
  const active = 284;
  const maint = 28;

  function vehicleStatusBadge(s: FleetVehicle["status"]) {
    const map = {
      active: {
        bg: "bg-emerald-50",
        dot: "bg-emerald-500",
        text: "text-emerald-800",
        label: t("vehicles.statusActive"),
      },
      maintenance: {
        bg: "bg-amber-50",
        dot: "bg-amber-500",
        text: "text-amber-800",
        label: t("vehicles.statusMaintenance"),
      },
      inactive: {
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        text: "text-gray-700",
        label: t("vehicles.inactive"),
      },
    }[s];
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.bg} ${map.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
        {map.label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("vehicles.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("vehicles.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenReg(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("vehicles.add")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("vehicles.total")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{total}</p>
              <p className="mt-2 text-xs text-gray-500">
                {t("vehicles.fleetSubtitle")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTruck size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("vehicles.active")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{active}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {t("vehicles.activeRate")}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiShield size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("vehicles.maintenance")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{maint}</p>
              <p className="mt-2 text-xs text-gray-500">
                {t("vehicles.needsMaintenanceSchedule")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTool size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder={t("vehicles.searchPlaceholder")}
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
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("vehicles.plate")}</th>
                <th className="px-5 py-3">{t("vehicles.model")}</th>
                <th className="px-5 py-3">{t("vehicles.year")}</th>
                <th className="px-5 py-3">{t("vehicles.capacity")}</th>
                <th className="px-5 py-3">{t("vehicles.assignedDriver")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {v.plate}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{v.model}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{v.year}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {v.capacity}
                    {t("vehicles.seats")}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {v.driver ?? "—"}
                  </td>
                  <td className="px-5 py-4">{vehicleStatusBadge(v.status)}</td>
                  <td className="px-5 py-4 text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setOpenEdit(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {tc("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setOpenMaint(true);
                      }}
                      className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {t("vehicles.maintenanceBtn")}
                    </button>
                    {v.status === "inactive" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t("vehicles.confirmDeleteVehicle"))) {
                            alert(t("vehicles.vehicleDeleted"));
                          }
                        }}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        {tc("delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {tc("showingItems", { count: filtered.length, total })}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {tc("previous")}
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
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {tc("next")}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={openReg}
        onClose={() => setOpenReg(false)}
        wide
        icon={<FiTruck size={20} />}
        title={t("vehicles.registerTitle")}
        subtitle={t("vehicles.registerSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenReg(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => setOpenReg(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("vehicles.register")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("vehicles.vehicleInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("vehicles.plate")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="51B-12345" />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.vin")}</label>
                <input className={inputClass} placeholder="KMHJ381..." />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.brand")}</label>
                <select className={inputClass} defaultValue="Hyundai">
                  <option>Hyundai</option>
                  <option>Thaco</option>
                  <option>Samco</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {t("vehicles.model")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Universe 40s" />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.productionYear")}</label>
                <input className={inputClass} placeholder="2022" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("vehicles.capacitySeats")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="40" />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.vehicleType")}</label>
                <select className={inputClass} defaultValue="sleeper">
                  <option value="sleeper">{t("vehicles.sleeper")}</option>
                  <option value="seat">{t("vehicles.seatType")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.cargoWeight")}</label>
                <input className={inputClass} placeholder="500" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("vehicles.legalOps")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("vehicles.inspectionExpiry")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.insuranceExpiry")}</label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>{t("vehicles.assignedDriver")}</label>
                <select className={inputClass} defaultValue="">
                  <option value="">{t("vehicles.unassigned")}</option>
                  <option>Nguyễn Văn An</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{tc("status")}</label>
                <select className={inputClass} defaultValue="active">
                  <option value="active">{t("vehicles.statusActive")}</option>
                  <option value="maint">{t("vehicles.statusMaintenance")}</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        wide
        icon={<FiTruck size={20} />}
        title={t("vehicles.editTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenEdit(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenEdit(false);
                alert(t("vehicles.updateSuccess"));
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              {t("vehicles.saveChanges")}
            </button>
          </>
        }
      >
        {selectedVehicle && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                {t("vehicles.vehicleInfo")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("vehicles.plate")}</label>
                  <input className={inputClass} defaultValue={selectedVehicle.plate} disabled />
                </div>
                <div>
                  <label className={labelClass}>{t("vehicles.model")}</label>
                  <input className={inputClass} defaultValue={selectedVehicle.model} />
                </div>
                <div>
                  <label className={labelClass}>{t("vehicles.year")}</label>
                  <input className={inputClass} defaultValue={selectedVehicle.year} />
                </div>
                <div>
                  <label className={labelClass}>{t("vehicles.capacity")}</label>
                  <input className={inputClass} defaultValue={selectedVehicle.capacity} />
                </div>
              </div>
            </section>
            <div className="border-t border-gray-100" />
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                {t("vehicles.operations")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("vehicles.assignedDriver")}</label>
                  <select className={inputClass} defaultValue={selectedVehicle.driver || ""}>
                    <option value="">{t("vehicles.unassigned")}</option>
                    <option value="Nguyễn Văn An">Nguyễn Văn An</option>
                    <option value="Trần Văn B">Trần Văn B</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{tc("status")}</label>
                  <select className={inputClass} defaultValue={selectedVehicle.status}>
                    <option value="active">{t("vehicles.statusActive")}</option>
                    <option value="maintenance">{t("vehicles.statusMaintenance")}</option>
                    <option value="inactive">{t("vehicles.inactive")}</option>
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={openMaint}
        onClose={() => setOpenMaint(false)}
        icon={<FiTool size={20} />}
        title={t("vehicles.maintenanceTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenMaint(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMaint(false);
                alert(t("vehicles.maintenanceScheduled"));
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              {t("vehicles.confirmMaintenance")}
            </button>
          </>
        }
      >
        {selectedVehicle && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {t("vehicles.vehicleLabel")}{" "}
                <span className="font-mono">{selectedVehicle.plate}</span>
              </p>
              <p className="text-sm text-amber-800 mt-1">
                {selectedVehicle.model}
              </p>
            </div>

            <div>
              <label className={labelClass}>{t("vehicles.maintenanceType")}</label>
              <select className={inputClass} defaultValue="routine">
                <option value="routine">{t("vehicles.routineMaintenance")}</option>
                <option value="repair">{t("vehicles.repair")}</option>
                <option value="inspection">{t("vehicles.safetyInspection")}</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>{t("vehicles.plannedDate")}</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{t("vehicles.plannedDuration")}</label>
              <input type="number" className={inputClass} placeholder="3" />
            </div>

            <div>
              <label className={labelClass}>{t("vehicles.workDescription")}</label>
              <textarea
                className={inputClass + " min-h-[100px]"}
                placeholder={t("vehicles.workDescriptionPlaceholder")}
                rows={4}
              />
            </div>

            <div>
              <label className={labelClass}>{t("vehicles.maintenanceContractor")}</label>
              <input
                type="text"
                className={inputClass}
                placeholder={t("vehicles.contractorPlaceholder")}
              />
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">{t("vehicles.maintenanceNoteLabel")}</span>{" "}
                {t("vehicles.maintenanceWarning")}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
