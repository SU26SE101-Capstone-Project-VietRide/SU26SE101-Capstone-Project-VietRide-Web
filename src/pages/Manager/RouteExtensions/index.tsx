import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDollarSign,
  FiEdit2,
  FiGitBranch,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import {
  createAlternativeRoute,
  createRouteFareTemplate,
  deleteAlternativeRoute,
  getAlternativeRoutes,
  getOperatorRoutes,
  getRouteFareTemplates,
  updateAlternativeRoute,
  updateAlternativeRouteGeometry,
  type AlternativeRoute,
  type AlternativeRouteRequest,
  type FareTemplate,
  type OperatorRoute,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";

type Tab = "fares" | "alternatives";

type AlternativeForm = {
  name: string;
  description: string;
  destinationStationId: string;
  totalDistanceKm: string;
  estimatedDurationMinutes: string;
  isActive: boolean;
  stopsJson: string;
  pathPolyline: string;
};

const emptyAlternativeForm: AlternativeForm = {
  name: "",
  description: "",
  destinationStationId: "",
  totalDistanceKm: "0",
  estimatedDurationMinutes: "0",
  isActive: true,
  stopsJson: "[]",
  pathPolyline: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStops(value: string): AlternativeRouteRequest["stops"] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const stops = parsed.map((item) => {
      if (!isRecord(item)) return null;
      const stopId = typeof item.stopId === "string" ? item.stopId : "";
      const orderIndex = Number(item.orderIndex);
      const estimatedDurationFromOriginMinutes = Number(
        item.estimatedDurationFromOriginMinutes,
      );
      const distanceFromOriginKm = Number(item.distanceFromOriginKm);
      if (
        !stopId ||
        !Number.isInteger(orderIndex) ||
        orderIndex <= 0 ||
        !Number.isFinite(estimatedDurationFromOriginMinutes) ||
        estimatedDurationFromOriginMinutes < 0 ||
        !Number.isFinite(distanceFromOriginKm) ||
        distanceFromOriginKm < 0
      ) {
        return null;
      }
      return {
        stopId,
        orderIndex,
        estimatedDurationFromOriginMinutes,
        distanceFromOriginKm,
      };
    });

    return stops.every((item) => item !== null)
      ? (stops as AlternativeRouteRequest["stops"])
      : null;
  } catch {
    return null;
  }
}

function toAlternativeForm(route: AlternativeRoute): AlternativeForm {
  return {
    name: route.name,
    description: route.description ?? "",
    destinationStationId: route.destinationStationId,
    totalDistanceKm: String(route.totalDistanceKm ?? 0),
    estimatedDurationMinutes: String(route.estimatedDurationMinutes ?? 0),
    isActive: route.isActive,
    stopsJson: JSON.stringify(route.stops ?? [], null, 2),
    pathPolyline: route.pathPolyline ?? "",
  };
}

export default function RouteExtensions() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canMutate = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [fares, setFares] = useState<FareTemplate[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[]>([]);
  const [tab, setTab] = useState<Tab>("fares");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fareOpen, setFareOpen] = useState(false);
  const [fareForm, setFareForm] = useState({
    stopId: "",
    fareFromThisStop: "",
    effectiveFrom: "",
    effectiveUntil: "",
  });
  const [alternativeOpen, setAlternativeOpen] = useState(false);
  const [editingAlternative, setEditingAlternative] =
    useState<AlternativeRoute | null>(null);
  const [alternativeForm, setAlternativeForm] = useState<AlternativeForm>(
    emptyAlternativeForm,
  );
  const pageSize = 10;

  useEffect(() => {
    let ignore = false;
    void getOperatorRoutes({ page: 1, pageSize: 100, sortBy: "name", sortDir: "asc" })
      .then((result) => {
        if (ignore) return;
        setRoutes(result.items);
        setRouteId((current) => current || result.items[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load routes",
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!routeId) {
      setFares([]);
      setAlternatives([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [fareResult, alternativeResult] = await Promise.all([
        getRouteFareTemplates(routeId, {
          page: tab === "fares" ? page : 1,
          pageSize,
        }),
        getAlternativeRoutes(routeId, {
          page: tab === "alternatives" ? page : 1,
          pageSize,
        }),
      ]);
      setFares(fareResult.items);
      setAlternatives(alternativeResult.items);
      setTotalItems(
        tab === "fares" ? fareResult.totalItems : alternativeResult.totalItems,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("routeExtensions.loadFailed", {
              defaultValue: "Không thể tải cấu hình tuyến.",
            }),
      );
    } finally {
      setLoading(false);
    }
  }, [page, routeId, tab, t]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === routeId),
    [routeId, routes],
  );

  async function submitFare(event: FormEvent) {
    event.preventDefault();
    if (!routeId) return;
    const fare = Number(fareForm.fareFromThisStop);
    if (
      !fareForm.stopId.trim() ||
      !Number.isFinite(fare) ||
      fare < 0 ||
      !fareForm.effectiveFrom
    ) {
      setError(
        t("routeExtensions.invalidFare", {
          defaultValue: "Stop, giá vé và ngày hiệu lực là bắt buộc.",
        }),
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createRouteFareTemplate(routeId, {
        stopId: fareForm.stopId.trim(),
        fareFromThisStop: fare,
        effectiveFrom: new Date(fareForm.effectiveFrom).toISOString(),
        effectiveUntil: fareForm.effectiveUntil
          ? new Date(fareForm.effectiveUntil).toISOString()
          : undefined,
      });
      setFareOpen(false);
      setFareForm({
        stopId: "",
        fareFromThisStop: "",
        effectiveFrom: "",
        effectiveUntil: "",
      });
      setMessage(
        t("routeExtensions.fareCreated", {
          defaultValue: "Đã tạo fare template.",
        }),
      );
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save fare",
      );
    } finally {
      setSaving(false);
    }
  }

  function openAlternative(route?: AlternativeRoute) {
    setEditingAlternative(route ?? null);
    setAlternativeForm(
      route ? toAlternativeForm(route) : emptyAlternativeForm,
    );
    setAlternativeOpen(true);
  }

  async function submitAlternative(event: FormEvent) {
    event.preventDefault();
    if (!routeId) return;
    const stops = parseStops(alternativeForm.stopsJson);
    const totalDistanceKm = Number(alternativeForm.totalDistanceKm);
    const estimatedDurationMinutes = Number(
      alternativeForm.estimatedDurationMinutes,
    );
    if (
      !alternativeForm.name.trim() ||
      !alternativeForm.destinationStationId.trim() ||
      !stops ||
      !Number.isFinite(totalDistanceKm) ||
      totalDistanceKm < 0 ||
      !Number.isFinite(estimatedDurationMinutes) ||
      estimatedDurationMinutes < 0
    ) {
      setError(
        t("routeExtensions.invalidAlternative", {
          defaultValue:
            "Kiểm tra tên, destination station, quãng đường, thời lượng và JSON stops.",
        }),
      );
      return;
    }

    const request: AlternativeRouteRequest = {
      name: alternativeForm.name.trim(),
      description: alternativeForm.description.trim(),
      destinationStationId: alternativeForm.destinationStationId.trim(),
      totalDistanceKm,
      estimatedDurationMinutes,
      isActive: alternativeForm.isActive,
      stops,
    };

    setSaving(true);
    setError("");
    try {
      const saved = editingAlternative
        ? await updateAlternativeRoute(editingAlternative.id, request)
        : await createAlternativeRoute(routeId, request);
      if (
        alternativeForm.pathPolyline.trim() !==
        (editingAlternative?.pathPolyline ?? "")
      ) {
        await updateAlternativeRouteGeometry(saved.id, {
          pathPolyline: alternativeForm.pathPolyline.trim() || null,
        });
      }
      setAlternativeOpen(false);
      setMessage(
        t("routeExtensions.alternativeSaved", {
          defaultValue: "Đã lưu tuyến thay thế.",
        }),
      );
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save alternative route",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAlternative(route: AlternativeRoute) {
    if (!window.confirm(`${tc("delete")} ${route.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteAlternativeRoute(route.id);
      await loadData();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to delete alternative route",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("routeExtensions.title", {
              defaultValue: "Giá theo điểm dừng & tuyến thay thế",
            })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("routeExtensions.subtitle", {
              defaultValue:
                "Quản lý fare template, alternative route và encoded polyline theo từng tuyến.",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium"
        >
          <FiRefreshCw />
          {tc("refresh")}
        </button>
      </header>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {!canMutate && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {t("routeExtensions.readOnly", {
            defaultValue:
              "OPERATOR_STAFF có quyền xem; thao tác thay đổi chỉ dành cho OPERATOR_ADMIN.",
          })}
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="block max-w-xl">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {t("routeExtensions.route", { defaultValue: "Tuyến" })}
          </span>
          <CustomSelect
            value={routeId}
            onChange={(event) => {
              setRouteId(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </CustomSelect>
        </label>
        {selectedRoute && (
          <p className="mt-2 text-xs text-gray-500">
            {selectedRoute.originStation?.name ?? selectedRoute.originStationId} →{" "}
            {selectedRoute.destinationStation?.name ??
              selectedRoute.destinationStationId}
          </p>
        )}
      </section>

      <div className="flex border-b border-gray-200">
        {(["fares", "alternatives"] as const).map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
            className={`border-b-2 px-5 py-3 text-sm font-semibold ${
              tab === item
                ? "border-vr-500 text-vr-700"
                : "border-transparent text-gray-500"
            }`}
          >
            {item === "fares" ? "Fare templates" : "Alternative routes"}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="font-bold text-gray-900">
            {tab === "fares" ? "Fare templates" : "Alternative routes"}
          </h2>
          {canMutate && (
            <button
              type="button"
              onClick={() =>
                tab === "fares" ? setFareOpen(true) : openAlternative()
              }
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white"
            >
              <FiPlus />
              {tc("create")}
            </button>
          )}
        </div>

        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        ) : tab === "fares" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">Stop ID</th>
                  <th className="px-4 py-3">{tc("price")}</th>
                  <th className="px-4 py-3">Effective from</th>
                  <th className="px-4 py-3">Effective until</th>
                </tr>
              </thead>
              <tbody>
                {fares.map((fare) => (
                  <tr key={fare.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs">{fare.stopId}</td>
                    <td className="px-4 py-3 font-semibold">
                      {fare.fareFromThisStop.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="px-4 py-3">{formatDateTime(fare.effectiveFrom)}</td>
                    <td className="px-4 py-3">{formatDateTime(fare.effectiveUntil)}</td>
                  </tr>
                ))}
                {fares.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      {tc("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {alternatives.map((route) => (
              <article
                key={route.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{route.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {route.totalDistanceKm} km · {route.estimatedDurationMinutes} min
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                    {route.isActive ? tc("active") : tc("inactive")}
                  </span>
                </div>
                {canMutate && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openAlternative(route)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <FiEdit2 /> {tc("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeAlternative(route)}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-100 px-3 py-2 text-sm text-rose-600"
                    >
                      <FiTrash2 /> {tc("delete")}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {alternatives.length === 0 && (
              <p className="md:col-span-2 py-10 text-center text-sm text-gray-500">
                {tc("noData")}
              </p>
            )}
          </div>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>

      <Modal
        open={fareOpen}
        onClose={() => setFareOpen(false)}
        icon={<FiDollarSign />}
        title="Create fare template"
        footer={
          <>
            <button type="button" onClick={() => setFareOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
              {tc("cancel")}
            </button>
            <button type="submit" form="fare-template-form" disabled={saving} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {tc("save")}
            </button>
          </>
        }
      >
        <form id="fare-template-form" className="space-y-4" onSubmit={(event) => void submitFare(event)}>
          <input className={inputClass} placeholder="Stop ID" value={fareForm.stopId} onChange={(event) => setFareForm({ ...fareForm, stopId: event.target.value })} required />
          <input className={inputClass} type="number" min={0} placeholder="Fare (VND)" value={fareForm.fareFromThisStop} onChange={(event) => setFareForm({ ...fareForm, fareFromThisStop: event.target.value })} required />
          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-600">Effective from</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={fareForm.effectiveFrom}
              onChange={(event) => setFareForm({ ...fareForm, effectiveFrom: event.target.value })}
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-600">Effective until</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={fareForm.effectiveUntil}
              onChange={(event) => setFareForm({ ...fareForm, effectiveUntil: event.target.value })}
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={alternativeOpen}
        onClose={() => setAlternativeOpen(false)}
        wide
        icon={<FiGitBranch />}
        title={editingAlternative ? "Edit alternative route" : "Create alternative route"}
        footer={
          <>
            <button type="button" onClick={() => setAlternativeOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
              {tc("cancel")}
            </button>
            <button type="submit" form="alternative-route-form" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <FiSave /> {tc("save")}
            </button>
          </>
        }
      >
        <form id="alternative-route-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitAlternative(event)}>
          <input className={inputClass} placeholder="Name" value={alternativeForm.name} onChange={(event) => setAlternativeForm({ ...alternativeForm, name: event.target.value })} required />
          <input className={inputClass} placeholder="Destination station ID" value={alternativeForm.destinationStationId} onChange={(event) => setAlternativeForm({ ...alternativeForm, destinationStationId: event.target.value })} required />
          <input className={inputClass} type="number" min={0} step="0.1" placeholder="Distance (km)" value={alternativeForm.totalDistanceKm} onChange={(event) => setAlternativeForm({ ...alternativeForm, totalDistanceKm: event.target.value })} />
          <input className={inputClass} type="number" min={0} placeholder="Duration (minutes)" value={alternativeForm.estimatedDurationMinutes} onChange={(event) => setAlternativeForm({ ...alternativeForm, estimatedDurationMinutes: event.target.value })} />
          <textarea className={`${inputClass} sm:col-span-2`} placeholder="Description" value={alternativeForm.description} onChange={(event) => setAlternativeForm({ ...alternativeForm, description: event.target.value })} />
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Stops JSON</span>
            <textarea className={`${inputClass} min-h-36 font-mono text-xs`} value={alternativeForm.stopsJson} onChange={(event) => setAlternativeForm({ ...alternativeForm, stopsJson: event.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Google encoded polyline</span>
            <textarea className={`${inputClass} min-h-20 font-mono text-xs`} value={alternativeForm.pathPolyline} onChange={(event) => setAlternativeForm({ ...alternativeForm, pathPolyline: event.target.value })} />
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={alternativeForm.isActive} onChange={(event) => setAlternativeForm({ ...alternativeForm, isActive: event.target.checked })} className="h-4 w-4 accent-vr-500" />
            {tc("active")}
          </label>
        </form>
      </Modal>
    </div>
  );
}
