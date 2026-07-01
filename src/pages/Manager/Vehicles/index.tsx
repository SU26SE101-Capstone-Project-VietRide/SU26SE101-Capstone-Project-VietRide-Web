import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiEdit2,
  FiEye,
  FiFilter,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import { FaChair } from "react-icons/fa";
import Modal from "../../../components/Modal";
import {
  createOperatorVehicle,
  getOperatorVehicle,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorVehicle,
  type OperatorVehicle,
  type OperatorVehicleRequest,
  type SeatLayoutJson,
  type VehicleDeck,
  type VehicleSeat,
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
  maxCargoVolumeM3: string;
  status: string;
  deckCount: string;
  rowsPerDeck: string;
  columnsPerRow: string;
  aisleAfterCol: string;
  seatPrefix: string;
};

const emptyVehicleForm: VehicleForm = {
  vehicleTypeId: "",
  licensePlate: "",
  totalSeats: "40",
  maxCargoWeightKg: "500",
  maxCargoVolumeM3: "5",
  status: "ACTIVE",
  deckCount: "1",
  rowsPerDeck: "10",
  columnsPerRow: "4",
  aisleAfterCol: "2",
  seatPrefix: "A",
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function toPositiveInteger(value: string, fallback: number) {
  const next = Math.floor(Number(value));
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function toSeatLayoutOptions(form: VehicleForm) {
  const seatPrefix = form.seatPrefix?.trim() || "A";
  const columnsPerRow = toPositiveInteger(form.columnsPerRow, 4);
  const aisleAfterCol = Math.min(
    toPositiveInteger(form.aisleAfterCol, 2),
    Math.max(columnsPerRow - 1, 1),
  );

  return {
    deckCount: toPositiveInteger(form.deckCount, 1),
    rowsPerDeck: toPositiveInteger(form.rowsPerDeck, 10),
    columnsPerRow,
    aisleAfterCol,
    seatPrefix,
  };
}

function createDecks(form: VehicleForm): VehicleDeck[] {
  const options = toSeatLayoutOptions(form);

  return Array.from({ length: options.deckCount }, (_, deckIndex) => {
    const seats = Array.from(
      { length: options.rowsPerDeck * options.columnsPerRow },
      (_, seatIndex) => {
        const row = Math.floor(seatIndex / options.columnsPerRow) + 1;
        const col = (seatIndex % options.columnsPerRow) + 1;
        const number = seatIndex + 1;

        return {
          seatNumber:
            options.deckCount > 1
              ? `${options.seatPrefix}${deckIndex + 1}-${number}`
              : `${options.seatPrefix}${number}`,
          row,
          col,
          deck: deckIndex + 1,
          type: "STANDARD",
          isAvailable: true,
          isWindow: col === 1 || col === options.columnsPerRow,
          isAisle: false,
          disabled: false,
        };
      },
    );

    return { deck: deckIndex + 1, seats };
  });
}

function countSeats(decks: VehicleDeck[]) {
  return decks.reduce((total, deck) => total + deck.seats.length, 0);
}

function toSeatLayoutJson(
  form: VehicleForm,
  vehicleTypes: VehicleType[] = [],
): SeatLayoutJson {
  const decks = createDecks(form);
  const options = toSeatLayoutOptions(form);
  const seats = decks.flatMap((deck) => deck.seats);
  const vehicleType = vehicleTypes.find((type) => type.id === form.vehicleTypeId);

  return {
    version: 1,
    vehicleTypeCode: vehicleType?.code ?? "",
    totalSeats: seats.length,
    rows: options.rowsPerDeck,
    cols: options.columnsPerRow,
    decks: options.deckCount,
    aisles: [{ afterCol: options.aisleAfterCol }],
    seats,
  };
}

function groupSeatsByDeck(seats: VehicleSeat[]): VehicleDeck[] {
  const grouped = seats.reduce<Record<number, VehicleSeat[]>>((acc, seat) => {
    const deck = seat.deck ?? 1;
    acc[deck] = [...(acc[deck] ?? []), seat];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([deck, deckSeats]) => ({
      deck: Number(deck),
      seats: deckSeats,
    }))
    .sort((left, right) => left.deck - right.deck);
}

function getLayoutShape(vehicle: OperatorVehicle) {
  const decks = vehicle.decks ?? parseSeatLayoutDecks(vehicle.seatLayoutJson);
  const firstDeck = decks[0];

  if (!firstDeck) {
    return {
      deckCount: "1",
      rowsPerDeck: String(Math.max(1, Math.ceil(vehicle.totalSeats / 4))),
      columnsPerRow: "4",
    };
  }

  const maxRow = Math.max(...firstDeck.seats.map((seat) => seat.row), 1);
  const maxColumn = Math.max(...firstDeck.seats.map((seat) => seat.col), 1);

  return {
    deckCount: String(Math.max(decks.length, 1)),
    rowsPerDeck: String(maxRow),
    columnsPerRow: String(maxColumn),
  };
}

function parseSeatLayoutDecks(layout: OperatorVehicle["seatLayoutJson"]) {
  if (!layout) {
    return [];
  }

  if (typeof layout !== "string") {
    return groupSeatsByDeck(layout.seats);
  }

  try {
    const parsed = JSON.parse(layout) as Partial<SeatLayoutJson> & {
      decks?: VehicleDeck[] | number;
    };

    if (Array.isArray(parsed.seats)) {
      return groupSeatsByDeck(parsed.seats);
    }

    return Array.isArray(parsed.decks) ? parsed.decks : [];
  } catch {
    return [];
  }
}

function toVehicleRequest(
  form: VehicleForm,
  vehicleTypes: VehicleType[],
): OperatorVehicleRequest {
  const seatLayoutJson = toSeatLayoutJson(form, vehicleTypes);

  return {
    vehicleTypeId: form.vehicleTypeId,
    licensePlate: form.licensePlate,
    totalSeats: seatLayoutJson.totalSeats,
    maxCargoWeightKg: toNumber(form.maxCargoWeightKg),
    maxCargoVolumeM3: toNumber(form.maxCargoVolumeM3),
    seatLayoutJson,
  };
}

function getVehicleId(vehicle: OperatorVehicle) {
  return vehicle.vehicleId || vehicle.id || "";
}

export default function VehiclesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<OperatorVehicle | null>(
    null,
  );
  const [detailVehicle, setDetailVehicle] = useState<OperatorVehicle | null>(
    null,
  );
  const [vehicleForm, setVehicleForm] =
    useState<VehicleForm>(emptyVehicleForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
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
        const defaultSeatCount = typeResult.items[0].defaultSeatCount || 40;

        setVehicleForm((prev) => ({
          ...prev,
          vehicleTypeId: typeResult.items[0].id,
          totalSeats: String(defaultSeatCount),
          rowsPerDeck: String(Math.max(1, Math.ceil(defaultSeatCount / 4))),
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
          const defaultSeatCount = typeResult.items[0].defaultSeatCount || 40;

          setVehicleForm((prev) => ({
            ...prev,
            vehicleTypeId: prev.vehicleTypeId || typeResult.items[0].id,
            totalSeats: prev.totalSeats || String(defaultSeatCount),
            rowsPerDeck:
              prev.rowsPerDeck ||
              String(Math.max(1, Math.ceil(defaultSeatCount / 4))),
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
    const layoutShape = getLayoutShape(vehicle);

    setSelectedVehicle(vehicle);
    setVehicleForm({
      vehicleTypeId: vehicle.vehicleTypeId,
      licensePlate: vehicle.licensePlate,
      totalSeats: String(vehicle.totalSeats),
      maxCargoWeightKg: String(vehicle.maxCargoWeightKg),
      maxCargoVolumeM3: String(vehicle.maxCargoVolumeM3 ?? 5),
      status: vehicle.status,
      deckCount: layoutShape.deckCount,
      rowsPerDeck: layoutShape.rowsPerDeck,
      columnsPerRow: layoutShape.columnsPerRow,
      aisleAfterCol: "2",
      seatPrefix: "A",
    });
    setOpenEdit(true);
  }

  async function openDetailModal(vehicle: OperatorVehicle) {
    const vehicleId = getVehicleId(vehicle);

    if (!vehicleId) {
      setError(t("vehicles.missingVehicleForDetail"));
      return;
    }

    setOpenDetail(true);
    setIsDetailLoading(true);
    setError("");

    try {
      const detail = await getOperatorVehicle(vehicleId);
      setDetailVehicle(detail);
    } catch (err) {
      setOpenDetail(false);
      setError(err instanceof Error ? err.message : t("vehicles.loadDetailFailed"));
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleCreateVehicle() {
    await createOperatorVehicle(toVehicleRequest(vehicleForm, vehicleTypes));
    setMessage(t("vehicles.createSuccess"));
    setOpenReg(false);
    await loadVehicles();
  }

  async function handleUpdateVehicle() {
    if (!selectedVehicle) {
      return;
    }

    const vehicleId = getVehicleId(selectedVehicle);

    if (!vehicleId) {
      setError(t("vehicles.missingVehicleForUpdate"));
      return;
    }

    await updateOperatorVehicle(
      vehicleId,
      toVehicleRequest(vehicleForm, vehicleTypes),
    );
    setMessage(t("vehicles.updateSuccess"));
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
            {t("vehicles.apiSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadVehicles}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
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
                <th className="px-5 py-3">{t("vehicles.cargoKg")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => (
                <tr
                  key={getVehicleId(vehicle) || vehicle.licensePlate}
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
                  <td className="px-5 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailModal(vehicle)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                        title={t("vehicles.viewDetail")}
                        aria-label={t("vehicles.viewDetail")}
                      >
                        <FiEye size={16} />
                      </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(vehicle)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        title={tc("edit")}
                        aria-label={tc("edit")}
                    >
                        <FiEdit2 size={16} />
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            {t("vehicles.loading")}
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

      <VehicleDetailModal
        open={openDetail}
        vehicle={detailVehicle}
        isLoading={isDetailLoading}
        onClose={() => setOpenDetail(false)}
      />
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
  const previewDecks = createDecks(form);
  const generatedSeats = countSeats(previewDecks);
  const layoutOptions = toSeatLayoutOptions(form);
  const previewSeatLayout = toSeatLayoutJson(form);

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
            <option value="">{t("vehicles.selectVehicleType")}</option>
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
            value={generatedSeats}
            readOnly
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("vehicles.autoSeatCountHint")}
          </p>
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
          <label className={labelClass}>{t("vehicles.cargoVolumeM3")}</label>
          <input
            className={inputClass}
            min={0}
            step="0.1"
            type="number"
            value={form.maxCargoVolumeM3}
            onChange={(event) =>
              onChange("maxCargoVolumeM3", event.target.value)
            }
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

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("vehicles.seatLayoutDesign")}
            </h3>
            <p className="text-xs text-gray-500">
              {t("vehicles.seatLayoutApiHint")}
            </p>
          </div>
          <span className="rounded-full bg-vr-50 px-3 py-1 text-xs font-semibold text-vr-700">
            {t("vehicles.generatedSeats", { count: generatedSeats })}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <div>
            <label className={labelClass}>{t("vehicles.deckCount")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.deckCount}
              onChange={(event) => onChange("deckCount", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.rowsPerDeck")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.rowsPerDeck}
              onChange={(event) => onChange("rowsPerDeck", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.columnsPerRow")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.columnsPerRow}
              onChange={(event) => onChange("columnsPerRow", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.aisleAfterCol")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.aisleAfterCol}
              onChange={(event) => onChange("aisleAfterCol", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.seatPrefix")}</label>
            <input
              className={inputClass}
              value={form.seatPrefix}
              onChange={(event) => onChange("seatPrefix", event.target.value)}
              placeholder="A"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {previewDecks.map((deck) => (
            <div
              key={deck.deck}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("vehicles.deckLabel", { deck: deck.deck })}
                </p>
                <p className="text-xs text-gray-500">
                  {t("vehicles.generatedSeats", { count: deck.seats.length })}
                </p>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${layoutOptions.columnsPerRow}, minmax(2.5rem, 1fr))`,
                }}
              >
                {deck.seats.map((seat) => (
                  <div
                    key={`${deck.deck}-${seat.seatNumber}`}
                    className="flex flex-col items-center gap-1 rounded-md border border-vr-200 bg-vr-50 px-2 py-2 text-center text-xs font-semibold text-vr-700"
                    title={`row ${seat.row}, col ${seat.col}`}
                  >
                    <FaChair size={16} />
                    <span>{seat.seatNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">
            {t("vehicles.viewApiJson")}
          </summary>
          <pre className="max-h-56 overflow-auto border-t border-gray-100 p-3 text-xs text-gray-700">
            {JSON.stringify(previewSeatLayout, null, 2)}
          </pre>
        </details>
      </div>
    </Modal>
  );
}

function VehicleDetailModal({
  open,
  vehicle,
  isLoading,
  onClose,
}: {
  open: boolean;
  vehicle: OperatorVehicle | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const { t: tc } = useTranslation("common");
  const { t } = useTranslation("manager");
  const decks = vehicle ? parseSeatLayoutDecks(vehicle.seatLayoutJson) : [];
  const layout =
    vehicle?.seatLayoutJson && typeof vehicle.seatLayoutJson !== "string"
      ? vehicle.seatLayoutJson
      : null;
  const columnCount =
    layout?.cols ??
    Math.max(...decks.flatMap((deck) => deck.seats.map((seat) => seat.col)), 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiEye size={20} />}
      title={t("vehicles.detailTitle")}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          {t("vehicles.loadingDetail")}
        </div>
      )}

      {!isLoading && vehicle && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label={t("vehicles.vehicleId")} value={getVehicleId(vehicle)} />
            <DetailItem label={t("vehicles.plate")} value={vehicle.licensePlate} />
            <DetailItem
              label={t("vehicles.vehicleType")}
              value={
                vehicle.vehicleTypeName ??
                vehicle.vehicleTypeCode ??
                vehicle.vehicleTypeId
              }
            />
            <DetailItem label={t("vehicles.seatCount")} value={String(vehicle.totalSeats)} />
            <DetailItem
              label={t("vehicles.cargoWeight")}
              value={`${vehicle.maxCargoWeightKg} kg`}
            />
            <DetailItem
              label={t("vehicles.cargoVolume")}
              value={`${vehicle.maxCargoVolumeM3 ?? 0} m3`}
            />
            <DetailItem label={t("vehicles.deckCount")} value={String(layout?.decks ?? decks.length)} />
            <DetailItem label={tc("status")} value={vehicle.status} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("vehicles.seatMap")}
                </h3>
                <p className="text-xs text-gray-500">
                  {t("vehicles.disabledSeatHint")}
                </p>
              </div>
              {layout?.aisles?.[0] && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  {t("vehicles.aisleAfterColumn", {
                    column: layout.aisles[0].afterCol,
                  })}
                </span>
              )}
            </div>

            {decks.length === 0 ? (
              <p className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
                {t("vehicles.noSeatMap")}
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {decks.map((deck) => (
                  <div
                    key={deck.deck}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("vehicles.deckLabel", { deck: deck.deck })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("vehicles.generatedSeats", {
                          count: deck.seats.length,
                        })}
                      </p>
                    </div>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${columnCount}, minmax(2.5rem, 1fr))`,
                      }}
                    >
                      {deck.seats.map((seat) => (
                        <div
                          key={`${deck.deck}-${seat.seatNumber}`}
                          className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                            seat.disabled
                              ? "border-gray-200 bg-gray-100 text-gray-400"
                              : "border-vr-200 bg-vr-50 text-vr-700"
                          }`}
                          title={`row ${seat.row}, col ${seat.col}, type ${seat.type}`}
                        >
                          <FaChair size={16} />
                          <span>{seat.seatNumber}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value || "-"}
      </p>
    </div>
  );
}
