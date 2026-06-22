import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiFilter,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  createOperatorVehicle,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorVehicle,
  type OperatorVehicle,
  type OperatorVehicleRequest,
  type VehicleDeck,
  type VehicleType,
} from "../../../api/vietride";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type VehicleForm = {
  vehicleTypeId: string;
  licensePlate: string;
  totalSeats: string;
  maxCargoWeightKg: string;
  status: string;
};

const emptyVehicleForm: VehicleForm = {
  vehicleTypeId: "",
  licensePlate: "",
  totalSeats: "40",
  maxCargoWeightKg: "500",
  status: "ACTIVE",
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function createDecks(totalSeats: number): VehicleDeck[] {
  const seats = Array.from({ length: totalSeats }, (_, index) => ({
    seatNumber: `A${index + 1}`,
    row: Math.floor(index / 4) + 1,
    col: (index % 4) + 1,
    type: "STANDARD",
    isAvailable: true,
  }));

  return [{ deck: 1, seats }];
}

function toVehicleRequest(form: VehicleForm): OperatorVehicleRequest {
  const totalSeats = toNumber(form.totalSeats);

  return {
    vehicleTypeId: form.vehicleTypeId,
    licensePlate: form.licensePlate,
    totalSeats,
    maxCargoWeightKg: toNumber(form.maxCargoWeightKg),
    status: form.status,
    decks: createDecks(totalSeats),
  };
}

export default function VehiclesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openMaint, setOpenMaint] = useState(false);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<OperatorVehicle | null>(
    null,
  );
  const [vehicleForm, setVehicleForm] =
    useState<VehicleForm>(emptyVehicleForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadVehicles() {
    setIsLoading(true);
    setError("");

    try {
      const [vehicleResult, typeResult] = await Promise.all([
        getOperatorVehicles({ page: 1, pageSize: 20, search }),
        getVehicleTypes({ page: 1, pageSize: 50 }),
      ]);

      setVehicles(vehicleResult.items);
      setVehicleTypes(typeResult.items);

      if (!vehicleForm.vehicleTypeId && typeResult.items[0]) {
        setVehicleForm((prev) => ({
          ...prev,
          vehicleTypeId: typeResult.items[0].id,
          totalSeats: String(typeResult.items[0].defaultSeatCount || 40),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadSearchResults() {
      try {
        const [vehicleResult, typeResult] = await Promise.all([
          getOperatorVehicles({ page: 1, pageSize: 20, search }),
          getVehicleTypes({ page: 1, pageSize: 50 }),
        ]);

        if (ignore) {
          return;
        }

        setVehicles(vehicleResult.items);
        setVehicleTypes(typeResult.items);

        if (typeResult.items[0]) {
          setVehicleForm((prev) => ({
            ...prev,
            vehicleTypeId: prev.vehicleTypeId || typeResult.items[0].id,
            totalSeats:
              prev.totalSeats ||
              String(typeResult.items[0].defaultSeatCount || 40),
          }));
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load vehicles",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadSearchResults();

    return () => {
      ignore = true;
    };
  }, [search]);

  const filtered = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
          (vehicle.vehicleTypeName ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [search, vehicles],
  );

  const total = vehicles.length;
  const active = vehicles.filter((vehicle) => vehicle.status === "ACTIVE").length;
  const maint = vehicles.filter(
    (vehicle) => vehicle.status === "MAINTENANCE",
  ).length;

  function updateVehicleForm(key: keyof VehicleForm, value: string) {
    setVehicleForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal() {
    setSelectedVehicle(null);
    setVehicleForm((prev) => ({
      ...emptyVehicleForm,
      vehicleTypeId: prev.vehicleTypeId || vehicleTypes[0]?.id || "",
    }));
    setOpenReg(true);
  }

  function openEditModal(vehicle: OperatorVehicle) {
    setSelectedVehicle(vehicle);
    setVehicleForm({
      vehicleTypeId: vehicle.vehicleTypeId,
      licensePlate: vehicle.licensePlate,
      totalSeats: String(vehicle.totalSeats),
      maxCargoWeightKg: String(vehicle.maxCargoWeightKg),
      status: vehicle.status,
    });
    setOpenEdit(true);
  }

  async function handleCreateVehicle() {
    await createOperatorVehicle(toVehicleRequest(vehicleForm));
    setMessage("Vehicle created.");
    setOpenReg(false);
    await loadVehicles();
  }

  async function handleUpdateVehicle() {
    if (!selectedVehicle) {
      return;
    }

    await updateOperatorVehicle(
      selectedVehicle.vehicleId,
      toVehicleRequest(vehicleForm),
    );
    setMessage("Vehicle updated.");
    setOpenEdit(false);
    await loadVehicles();
  }

  function vehicleStatusBadge(status: string) {
    const map = {
      ACTIVE: {
        bg: "bg-emerald-50",
        dot: "bg-emerald-500",
        text: "text-emerald-800",
        label: t("vehicles.statusActive"),
      },
      MAINTENANCE: {
        bg: "bg-amber-50",
        dot: "bg-amber-500",
        text: "text-amber-800",
        label: t("vehicles.statusMaintenance"),
      },
      INACTIVE: {
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        text: "text-gray-700",
        label: t("vehicles.inactive"),
      },
    }[status] ?? {
      bg: "bg-gray-100",
      dot: "bg-gray-400",
      text: "text-gray-700",
      label: status,
    };

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
            Vehicles now use create/update API with generated seat decks.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadVehicles}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
          >
            <FiPlus size={18} />
            {t("vehicles.add")}
          </button>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={t("vehicles.total")} value={total} icon={<FiTruck size={20} />} />
        <MetricCard label={t("vehicles.active")} value={active} icon={<FiShield size={20} />} />
        <MetricCard label={t("vehicles.maintenance")} value={maint} icon={<FiTool size={20} />} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder={t("vehicles.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton icon={<FiFilter size={16} />} label={tc("filter")} />
            <ToolbarButton icon={<FiList size={16} />} label={tc("columns")} />
            <ToolbarButton icon={<FiDownload size={16} />} label={tc("exportCsv")} />
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
                <th className="px-5 py-3">{t("vehicles.capacity")}</th>
                <th className="px-5 py-3">Cargo kg</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => (
                <tr
                  key={vehicle.vehicleId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {vehicle.licensePlate}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {vehicle.vehicleTypeName ??
                      vehicle.vehicleTypeCode ??
                      vehicle.vehicleTypeId}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {vehicle.totalSeats}
                    {t("vehicles.seats")}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {vehicle.maxCargoWeightKg}
                  </td>
                  <td className="px-5 py-4">{vehicleStatusBadge(vehicle.status)}</td>
                  <td className="px-5 py-4 text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(vehicle)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {tc("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setOpenMaint(true);
                      }}
                      className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {t("vehicles.maintenanceBtn")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            Loading vehicles...
          </div>
        )}
      </div>

      <VehicleModal
        open={openReg}
        title={t("vehicles.registerTitle")}
        vehicleTypes={vehicleTypes}
        form={vehicleForm}
        onChange={updateVehicleForm}
        onClose={() => setOpenReg(false)}
        onSubmit={handleCreateVehicle}
        submitLabel={t("vehicles.register")}
      />

      <VehicleModal
        open={openEdit}
        title={t("vehicles.editTitle")}
        vehicleTypes={vehicleTypes}
        form={vehicleForm}
        onChange={updateVehicleForm}
        onClose={() => setOpenEdit(false)}
        onSubmit={handleUpdateVehicle}
        submitLabel={t("vehicles.saveChanges")}
      />

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
                setMessage("Maintenance marked locally. No maintenance API in screenshots.");
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              {t("vehicles.confirmMaintenance")}
            </button>
          </>
        }
      >
        {selectedVehicle && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {t("vehicles.vehicleLabel")}{" "}
              <span className="font-mono">{selectedVehicle.licensePlate}</span>
            </p>
            <p className="text-sm text-amber-800 mt-1">
              {selectedVehicle.vehicleTypeName ?? selectedVehicle.vehicleTypeId}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
          {icon}
        </div>
      </div>
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

function VehicleModal({
  open,
  title,
  vehicleTypes,
  form,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  title: string;
  vehicleTypes: VehicleType[];
  form: VehicleForm;
  onChange: (key: keyof VehicleForm, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTruck size={20} />}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t("vehicles.plate")}</label>
          <input
            className={inputClass}
            value={form.licensePlate}
            onChange={(event) => onChange("licensePlate", event.target.value)}
            placeholder="51B-12345"
          />
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.vehicleType")}</label>
          <select
            className={inputClass}
            value={form.vehicleTypeId}
            onChange={(event) => onChange("vehicleTypeId", event.target.value)}
          >
            <option value="">Select vehicle type</option>
            {vehicleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.capacitySeats")}</label>
          <input
            className={inputClass}
            type="number"
            value={form.totalSeats}
            onChange={(event) => onChange("totalSeats", event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.cargoWeight")}</label>
          <input
            className={inputClass}
            type="number"
            value={form.maxCargoWeightKg}
            onChange={(event) => onChange("maxCargoWeightKg", event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>{tc("status")}</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(event) => onChange("status", event.target.value)}
          >
            <option value="ACTIVE">{t("vehicles.statusActive")}</option>
            <option value="MAINTENANCE">{t("vehicles.statusMaintenance")}</option>
            <option value="INACTIVE">{t("vehicles.inactive")}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
