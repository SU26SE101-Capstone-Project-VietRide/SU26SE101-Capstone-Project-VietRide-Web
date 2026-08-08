import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiEye,
  FiMapPin,
  FiPlus,
  FiPower,
  FiSearch,
} from "react-icons/fi";
import {
  createAdminLocation,
  deleteAdminLocation,
  getAdminLocations,
  updateAdminLocation,
  type AdminLocation,
  type AdminLocationRequest,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { ConfirmModal } from "../../../components/ConfirmModal";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";

type LocationForm = {
  code: string;
  name: string;
  type: "PROVINCE" | "MUNICIPALITY";
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: LocationForm = {
  code: "",
  name: "",
  type: "PROVINCE",
  sortOrder: "0",
  isActive: true,
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
const actionButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function toForm(location: AdminLocation): LocationForm {
  return {
    code: location.code,
    name: location.name,
    type: location.type === "MUNICIPALITY" ? "MUNICIPALITY" : "PROVINCE",
    sortOrder: String(location.sortOrder),
    isActive: location.isActive,
  };
}

function toRequest(form: LocationForm): AdminLocationRequest | null {
  const code = form.code.trim().toUpperCase();
  const name = form.name.trim();
  const sortOrder = Number(form.sortOrder);

  if (
    !code ||
    !name ||
    !/^[A-Z0-9_-]+$/.test(code) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    return null;
  }

  return {
    code,
    name,
    type: form.type,
    sortOrder,
    isActive: form.isActive,
  };
}

export default function AdminLocations() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [items, setItems] = useState<AdminLocation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminLocation | null>(null);
  const [viewing, setViewing] = useState<AdminLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [pendingToggle, setPendingToggle] = useState<AdminLocation | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const pageSize = 12;

  const loadLocations = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getAdminLocations({
        page,
        pageSize,
        search: search.trim() || undefined,
        isActive: status ? status === "ACTIVE" : undefined,
      });
      setItems(result.items);
      setTotalItems(result.totalItems);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : tRef.current("locations.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLocations();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadLocations, reloadKey]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openDetail(location: AdminLocation) {
    setViewing(location);
  }

  function openEdit(location: AdminLocation) {
    setViewing(null);
    setEditing(location);
    setForm(toForm(location));
    setFormError("");
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    const request = toRequest(form);
    if (!request) {
      setFormError(t("locations.invalidForm"));
      return;
    }

    setSaving(true);
    setFormError("");
    setMessage(null);
    try {
      if (editing) {
        await updateAdminLocation(editing.id, request);
      } else {
        await createAdminLocation(request);
      }
      setFormOpen(false);
      setMessage({
        tone: "success",
        text: t("locations.saved"),
      });
      setReloadKey((value) => value + 1);
      setPendingToggle(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("locations.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(location: AdminLocation) {

    setSaving(true);
    setMessage(null);
    try {
      if (location.isActive) {
        await deleteAdminLocation(location.id);
      } else {
        await updateAdminLocation(location.id, { isActive: true });
      }
      setMessage({ tone: "success", text: t("locations.saved") });
      setReloadKey((value) => value + 1);
      setPendingToggle(null);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : t("locations.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  }

  useToastFeedback({ message: message?.tone === "success" ? message.text : "", error: formError || (message?.tone === "error" ? message.text : "") });
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("locations.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t("locations.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-600"
        >
          <FiPlus />
          {t("locations.create")}
        </button>
      </header>


      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} pl-10`}
              placeholder={t("locations.search")}
              aria-label={t("locations.searchLabel")}
            />
          </div>
          <CustomSelect
            value={status}
            aria-label={t("locations.filterStatus")}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">{tc("all")}</option>
            <option value="ACTIVE">{tc("active")}</option>
            <option value="INACTIVE">{tc("inactive")}</option>
          </CustomSelect>
        </div>

        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600">
                <th className="px-5 py-3 text-center">{t("locations.code")}</th>
                <th className="px-5 py-3 text-center">{t("locations.name")}</th>
                <th className="px-5 py-3 text-center">{t("locations.sortOrder")}</th>
                <th className="px-5 py-3 text-center">{tc("status")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                items.map((location) => (
                  <tr
                    key={location.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-5 py-4 text-center font-mono text-sm font-semibold text-vr-700">
                      {location.code}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => openDetail(location)}
                        className="text-center font-semibold text-gray-900 transition hover:text-vr-700"
                      >
                        {location.name}
                      </button>
                      <p className="mt-1 text-xs text-gray-400">
                        {t("locations.updatedAt", {
                          value: formatDateTime(location.updatedAt),
                        })}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-gray-700">
                      {location.sortOrder}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          location.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {location.isActive ? tc("active") : tc("inactive")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(location)}
                          className={`${actionButtonClass} text-slate-600`}
                          aria-label={t("locations.viewDetails")}
                          title={t("locations.viewDetails")}
                        >
                          <FiEye />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(location)}
                          className={`${actionButtonClass} text-vr-700`}
                          aria-label={tc("edit")}
                          title={tc("edit")}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingToggle(location)}
                          disabled={saving}
                          className={`${actionButtonClass} ${
                            location.isActive
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                          aria-label={
                            location.isActive ? tc("disable") : tc("enable")
                          }
                          title={
                            location.isActive ? tc("disable") : tc("enable")
                          }
                        >
                          <FiPower />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {t("locations.empty")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {tc("loading")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={(nextPage) => {
            setLoading(true);
            setPage(nextPage);
          }}
        />
      </section>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        icon={<FiMapPin />}
        title={viewing?.name ?? ""}
        subtitle={t("locations.detailSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {tc("close")}
            </button>
            {viewing && (
              <button
                type="button"
                onClick={() => openEdit(viewing)}
                className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-vr-600"
              >
                <FiEdit2 />
                {t("locations.edit")}
              </button>
            )}
          </>
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-xl border border-vr-100 bg-vr-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white font-mono text-sm font-bold text-vr-700 shadow-sm">
                  {viewing.code}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{viewing.name}</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {t("locations.detailHint")}
                  </p>
                </div>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                  viewing.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {viewing.isActive ? tc("active") : tc("inactive")}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <dt className="text-xs font-medium text-gray-500">
                  {t("locations.code")}
                </dt>
                <dd className="mt-1 font-mono font-semibold text-gray-900">
                  {viewing.code}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <dt className="text-xs font-medium text-gray-500">
                  {t("locations.sortOrder")}
                </dt>
                <dd className="mt-1 font-semibold text-gray-900">
                  {viewing.sortOrder}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <dt className="text-xs font-medium text-gray-500">
                  {t("locations.createdAt")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(viewing.createdAt)}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <dt className="text-xs font-medium text-gray-500">
                  {t("locations.lastUpdated")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(viewing.updatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setFormError("");
        }}
        icon={<FiMapPin />}
        title={editing ? t("locations.edit") : t("locations.create")}
        subtitle={
          editing ? t("locations.editSubtitle") : t("locations.createSubtitle")
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setFormError("");
              }}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              form="location-form"
              disabled={saving}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? t("locations.saving")
                : editing
                  ? t("locations.saveChanges")
                  : t("locations.createSubmit")}
            </button>
          </>
        }
      >
        <form
          id="location-form"
          className="space-y-5"
          onSubmit={(event) => void submitForm(event)}
        >

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelClass}>{t("locations.name")}</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className={inputClass}
                placeholder={t("locations.namePlaceholder")}
                maxLength={100}
                autoFocus
                required
              />
              <span className="mt-1.5 block text-xs text-gray-500">
                {t("locations.nameHint")}
              </span>
            </label>

            <label>
              <span className={labelClass}>{t("locations.code")}</span>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                className={inputClass}
                placeholder={t("locations.codePlaceholder")}
                pattern="[A-Za-z0-9_-]+"
                maxLength={20}
                required
              />
              <span className="mt-1.5 block text-xs text-gray-500">
                {t("locations.codeHint")}
              </span>
            </label>

            <label>
              <span className={labelClass}>{t("locations.sortOrder")}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value })
                }
                className={inputClass}
              />
              <span className="mt-1.5 block text-xs text-gray-500">
                {t("locations.sortOrderHint")}
              </span>
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 bg-slate-50 p-4 sm:col-span-2">
              <div>
                <span className="block text-sm font-semibold text-gray-900">
                  {t("locations.availableNow")}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {t("locations.availableNowHint")}
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                className="h-5 w-5 shrink-0 accent-vr-500"
              />
            </label>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        open={Boolean(pendingToggle)}
        onClose={() => setPendingToggle(null)}
        onConfirm={() => pendingToggle && void toggleActive(pendingToggle)}
        title={tc("confirm")}
        message={pendingToggle ? (pendingToggle.isActive ? t("locations.deactivateConfirm", { name: pendingToggle.name }) : t("locations.activateConfirm", { name: pendingToggle.name })) : ""}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone={pendingToggle?.isActive ? "danger" : "success"}
        busy={saving}
      />
    </div>
  );
}
