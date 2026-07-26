import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiMap,
  FiPlus,
  FiPower,
  FiRefreshCw,
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
    type:
      location.type === "MUNICIPALITY" ? "MUNICIPALITY" : "PROVINCE",
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
  const [items, setItems] = useState<AdminLocation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const pageSize = 12;

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setMessage(null);

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
            : t("locations.loadFailed", {
                defaultValue: "Không thể tải danh mục địa phương.",
              }),
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLocations();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadLocations, reloadKey]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(location: AdminLocation) {
    setEditing(location);
    setForm(toForm(location));
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    const request = toRequest(form);
    if (!request) {
      setMessage({
        tone: "error",
        text: t("locations.invalidForm", {
          defaultValue:
            "Mã chỉ gồm chữ, số, _ hoặc -; tên là bắt buộc và thứ tự phải là số nguyên không âm.",
        }),
      });
      return;
    }

    setSaving(true);
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
        text: t("locations.saved", {
          defaultValue: "Đã lưu địa phương.",
        }),
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("locations.saveFailed", {
                defaultValue: "Không thể lưu địa phương.",
              }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(location: AdminLocation) {
    if (
      !window.confirm(
        location.isActive
          ? t("locations.deactivateConfirm", {
              defaultValue: `Ngừng sử dụng ${location.name}?`,
            })
          : t("locations.activateConfirm", {
              defaultValue: `Kích hoạt lại ${location.name}?`,
            }),
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (location.isActive) {
        await deleteAdminLocation(location.id);
      } else {
        await updateAdminLocation(location.id, { isActive: true });
      }
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t("locations.saveFailed", {
                defaultValue: "Không thể cập nhật địa phương.",
              }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("locations.title", { defaultValue: "Danh mục địa phương" })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("locations.subtitle", {
              defaultValue:
                "Quản lý tỉnh và thành phố dùng chung cho station, stop và tìm kiếm chuyến.",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw />
            {tc("refresh")}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiPlus />
            {t("locations.create", { defaultValue: "Thêm địa phương" })}
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

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
              placeholder={t("locations.search", {
                defaultValue: "Tìm theo mã hoặc tên...",
              })}
            />
          </div>
          <CustomSelect
            value={status}
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <th className="px-5 py-3">
                  {t("locations.code", { defaultValue: "Mã" })}
                </th>
                <th className="px-5 py-3">
                  {t("locations.name", { defaultValue: "Tên" })}
                </th>
                <th className="px-5 py-3">
                  {t("locations.type", { defaultValue: "Loại" })}
                </th>
                <th className="px-5 py-3">
                  {t("locations.sortOrder", { defaultValue: "Thứ tự" })}
                </th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((location) => (
                <tr
                  key={location.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-5 py-4 font-mono text-sm font-semibold text-vr-700">
                    {location.code}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{location.name}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDateTime(location.updatedAt)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {location.type}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {location.sortOrder}
                  </td>
                  <td className="px-5 py-4">
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
                  <td className="px-5 py-4">
                    <div className="flex justify-center gap-2">
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
                        onClick={() => void toggleActive(location)}
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
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {t("locations.empty", {
                      defaultValue: "Không có địa phương phù hợp.",
                    })}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={6}
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
          onPageChange={setPage}
        />
      </section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        icon={<FiMap />}
        title={
          editing
            ? t("locations.edit", { defaultValue: "Sửa địa phương" })
            : t("locations.create", { defaultValue: "Thêm địa phương" })
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              form="location-form"
              disabled={saving}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {tc("save")}
            </button>
          </>
        }
      >
        <form id="location-form" onSubmit={(event) => void submitForm(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>
                {t("locations.code", { defaultValue: "Mã" })}
              </span>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
                className={inputClass}
                maxLength={20}
                required
              />
            </label>
            <label>
              <span className={labelClass}>
                {t("locations.type", { defaultValue: "Loại" })}
              </span>
              <CustomSelect
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value as LocationForm["type"],
                  })
                }
                className={inputClass}
              >
                <option value="PROVINCE">PROVINCE</option>
                <option value="MUNICIPALITY">MUNICIPALITY</option>
              </CustomSelect>
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>
                {t("locations.name", { defaultValue: "Tên" })}
              </span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className={inputClass}
                maxLength={100}
                required
              />
            </label>
            <label>
              <span className={labelClass}>
                {t("locations.sortOrder", { defaultValue: "Thứ tự" })}
              </span>
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
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                className="h-4 w-4 accent-vr-500"
              />
              {tc("active")}
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
