import { useToastFeedback } from "../../../hooks/useToastFeedback";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiEye,
  FiLayers,
  FiMapPin,
  FiPlus,
  FiPower,
  FiSearch,
} from "react-icons/fi";
import {
  createAdminLocation,
  deleteAdminLocation,
  getAdminLocations,
  getPublicLocations,
  isLeafLocationType,
  LOCATION_LEAF_TYPES,
  LOCATION_TOP_LEVEL_TYPES,
  updateAdminLocation,
  type AdminLocation,
  type AdminLocationRequest,
  type LocationType,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import InfoHint from "../../../components/InfoHint";
import Modal from "../../../components/Modal";
import { ConfirmModal } from "../../../components/ConfirmModal";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import { formatDateTime } from "../../../utils/date";
import Checkbox from "../../../components/form/Checkbox";


type LocationForm = {
  code: string;
  name: string;
  type: LocationType;
  sortOrder: string;
  isActive: boolean;
  /** Chỉ dùng cho leaf; top-level bỏ qua */
  parentCode: string;
};

const emptyForm: LocationForm = {
  code: "",
  name: "",
  type: "PROVINCE",
  sortOrder: "0",
  isActive: true,
  parentCode: "",
};

// BE bắt code chỉ chữ số và đúng độ dài theo cấp: 2 với tỉnh/thành, 5 với
// phường/xã/đặc khu. Giữ nguyên số 0 đầu nên phải xử lý như chuỗi.
const TOP_LEVEL_CODE_LENGTH = 2;
const LEAF_CODE_LENGTH = 5;

function expectedCodeLength(type: LocationType) {
  return isLeafLocationType(type) ? LEAF_CODE_LENGTH : TOP_LEVEL_CODE_LENGTH;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
const actionButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function toForm(location: AdminLocation): LocationForm {
  return {
    code: location.code,
    name: location.name,
    type: (location.type as LocationType) ?? "PROVINCE",
    sortOrder: String(location.sortOrder),
    isActive: location.isActive,
    parentCode: location.parentCode ?? "",
  };
}

function toRequest(form: LocationForm): AdminLocationRequest | null {
  // Không uppercase: code là chuỗi chữ số, "01" phải giữ nguyên số 0 đầu
  const code = form.code.trim();
  const name = form.name.trim();
  const sortOrder = Number(form.sortOrder);
  const isLeaf = isLeafLocationType(form.type);
  const parentCode = form.parentCode.trim();

  if (
    !name ||
    code.length !== expectedCodeLength(form.type) ||
    !/^[0-9]+$/.test(code) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    (isLeaf && !/^\d{2}$/.test(parentCode))
  ) {
    return null;
  }

  return {
    code,
    name,
    type: form.type,
    sortOrder,
    isActive: form.isActive,
    ...(isLeaf ? { parentCode } : {}),
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
  const [totalItems, setTotalItems] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [administrativeType, setAdministrativeType] = useState<"" | LocationType>("");
  const [parentCode, setParentCode] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminLocation | null>(null);
  const [viewing, setViewing] = useState<AdminLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [pendingToggle, setPendingToggle] = useState<AdminLocation | null>(null);
  // Danh sách tỉnh/thành để chọn parent cho phường/xã. Dùng endpoint public vì
  // nó đã trả đúng "chỉ top-level active" khi không truyền parentCode.
  const [provinces, setProvinces] = useState<AdminLocation[]>([]);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const pageSize = 10;

  // Toàn bộ search/filter chạy server-side. Trước đây BE bỏ qua `type` và
  // `parentCode` nên màn phải tải trọn danh mục ~3.4k bản ghi bằng 34 request
  // rồi lọc ở client; BE đã bổ sung nên giờ chỉ còn đúng 1 request mỗi trang.
  const loadLocations = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getAdminLocations({
        page,
        pageSize,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status ? { isActive: status === "ACTIVE" } : {}),
        ...(administrativeType ? { type: administrativeType } : {}),
        ...(parentCode ? { parentCode } : {}),
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
  }, [administrativeType, debouncedSearch, page, parentCode, status]);

  // Xoá bản ghi cuối của trang cuối làm `page` vượt quá dữ liệu còn lại — kẹp
  // lúc đọc thay vì setState trong effect để không tạo render thừa.
  const safePage = Math.min(page, Math.max(1, Math.ceil(totalItems / pageSize)));

  // Search giờ đi thẳng lên BE nên phải debounce, nếu không mỗi phím là một
  // request. Đổi từ khoá thì về trang 1 vì tổng số bản ghi đã khác.
  //
  // Bỏ qua lượt chạy đầu: effect cũng chạy lúc mount, và 350ms sau đó nó gọi
  // `setPage(1)` dù người dùng chưa gõ gì. Ai bấm sang trang trong khoảng 350ms
  // đầu sẽ bị đá ngược về trang 1 — `debouncedSearch` lúc mount vốn đã bằng
  // `search` nên bỏ lượt này không làm lệch state.
  const hasSearchChanged = useRef(false);
  useEffect(() => {
    if (!hasSearchChanged.current) {
      hasSearchChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Hoãn sang macrotask: gọi thẳng trong effect là setState đồng bộ khi
    // request resolve ngay (mock trong test), gây cascading render.
    const timer = window.setTimeout(() => void loadLocations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations, reloadKey]);

  // Thẻ "Đang hoạt động" đếm trên toàn hệ thống, không đổi theo filter của bảng —
  // trước đây đếm `items.filter(...)` nên trần cứng ở pageSize. BE chưa có
  // `/locations/summary` nên đọc `totalItems` của một truy vấn pageSize=1.
  useEffect(() => {
    let ignore = false;
    void getAdminLocations({ page: 1, pageSize: 1, isActive: true })
      .then((result) => {
        if (!ignore) setActiveTotal(result.totalItems);
      })
      .catch(() => {
        // Thẻ thống kê lỗi không được chặn bảng chính
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let ignore = false;
    void getPublicLocations()
      .then((result) => {
        if (!ignore) setProvinces(result.filter((item) => item.isActive));
      })
      .catch(() => {
        // Thiếu danh sách tỉnh chỉ chặn việc tạo phường/xã, không chặn cả màn
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

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


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t("locations.totalStat")} value={totalItems} icon={<FiMapPin size={20} />} iconClassName="bg-vr-50 text-vr-700" isLoading={loading} />
        <StatCard label={t("locations.activeStat")} value={activeTotal} icon={<FiPower size={20} />} iconClassName="bg-emerald-50 text-emerald-700" isLoading={loading} />
        <StatCard label={t("locations.levelStat")} value={new Set(items.map((item) => item.type)).size} icon={<FiLayers size={20} />} iconClassName="bg-violet-50 text-violet-700" isLoading={loading} />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(145px,0.85fr)_minmax(160px,0.85fr)_minmax(200px,1.1fr)]">
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
          <CustomSelect value={administrativeType} aria-label={t("locations.filterType")} onChange={(event) => { setAdministrativeType(event.target.value as "" | LocationType); setPage(1); }} className={inputClass}><option value="">{tc("all")}</option>{[...LOCATION_TOP_LEVEL_TYPES, ...LOCATION_LEAF_TYPES].map((type) => <option key={type} value={type}>{t(`locations.types.${type}`, { defaultValue: type })}</option>)}</CustomSelect>
          <CustomSelect
            value={parentCode}
            aria-label={t("locations.filterParent")}
            searchable
            searchPlaceholder={tc("searchOptions", {
              label: t("locations.parent"),
            })}
            emptyMessage={tc("noMatchingOptions")}
            onChange={(event) => {
              setParentCode(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">
              {t("locations.allParents")}
            </option>
            {provinces.map((province) => (
              <option key={province.id} value={province.code}>
                {province.name}
              </option>
            ))}
          </CustomSelect>
        </div>

        <div className="overflow-hidden" aria-busy={loading}>
          <table className="w-full table-fixed whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600">
                <th className="w-[8%] px-3 py-3 text-center sm:px-5">{t("locations.code")}</th>
                <th className="w-[24%] px-3 py-3 text-left sm:px-5">{t("locations.name")}</th>
                <th className="w-[18%] px-3 py-3 text-center sm:px-5">{t("locations.type")}</th>
                <th className="w-[16%] px-3 py-3 text-center sm:px-5">{t("locations.parent")}</th>
                <th className="w-[8%] px-3 py-3 text-center sm:px-5">{t("locations.sortOrder")}</th>
                <th className="w-[10%] px-3 py-3 text-center sm:px-5">{tc("status")}</th>
                <th className="w-[16%] px-3 py-3 text-center sm:px-5">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                items.map((location) => (
                  <tr
                    key={location.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="w-[8%] whitespace-nowrap px-3 py-4 text-center font-mono text-sm font-semibold text-vr-700 sm:px-5">
                      {location.code}
                    </td>
                    <td className="w-[24%] min-w-0 px-3 py-4 text-left sm:px-5">
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
                    <td className="w-[18%] whitespace-nowrap px-3 py-4 text-center sm:px-5">
                      {/* inline-flex + gap: chữ viết tắt và dấu "!" tách nhau ra
                          và cùng nằm giữa theo trục dọc, thay vì dấu "!" dính
                          sát chữ và trôi theo baseline. */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isLeafLocationType(location.type)
                            ? "bg-sky-50 text-sky-700"
                            : "bg-violet-50 text-violet-700"
                        }`}
                      >
                        {t(`locations.types.${location.type}`, {
                          defaultValue: location.type,
                        })}
                        {location.type === "MUNICIPALITY" && (
                          <InfoHint
                            label={t("locations.whatIsThis")}
                            text={t("locations.typeFullName.MUNICIPALITY")}
                          />
                        )}
                      </span>
                    </td>
                    <td className="w-[16%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700 sm:px-5">
                      {location.parentName ? (
                        location.parentName
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="w-[8%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700 sm:px-5">
                      {location.sortOrder}
                    </td>
                    <td className="w-[10%] whitespace-nowrap px-3 py-4 text-center sm:px-5">
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
                    <td className="w-[16%] whitespace-nowrap px-3 py-4 text-center sm:px-5">
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
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {t("locations.empty")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={7}
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
          page={safePage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
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
                  {t("locations.type")}
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 font-semibold text-gray-900">
                  {t(`locations.types.${viewing.type}`, {
                    defaultValue: viewing.type,
                  })}
                  {viewing.type === "MUNICIPALITY" && (
                    <InfoHint
                      label={t("locations.whatIsThis")}
                      text={t("locations.typeFullName.MUNICIPALITY")}
                    />
                  )}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <dt className="text-xs font-medium text-gray-500">
                  {t("locations.parent")}
                </dt>
                <dd className="mt-1 font-semibold text-gray-900">
                  {viewing.parentName
                    ? `${viewing.parentName}`
                    : "—"}
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
              <span className={labelClass}>{t("locations.type")}</span>
              <CustomSelect
                aria-label={t("locations.type")}
                value={form.type}
                onChange={(event) => {
                  const nextType = event.target.value as LocationType;
                  setForm({
                    ...form,
                    type: nextType,
                    // Đổi sang cấp tỉnh thì parent không còn ý nghĩa
                    parentCode: isLeafLocationType(nextType)
                      ? form.parentCode
                      : "",
                  });
                }}
                className={inputClass}
              >
                {[...LOCATION_TOP_LEVEL_TYPES, ...LOCATION_LEAF_TYPES].map(
                  (type) => (
                    <option key={type} value={type}>
                      {t(`locations.types.${type}`, { defaultValue: type })}
                    </option>
                  ),
                )}
              </CustomSelect>
              {form.type === "MUNICIPALITY" && (
                <span className="mt-1.5 block text-xs font-medium text-vr-700">
                  {t("locations.types.MUNICIPALITY")} ={" "}
                  {t("locations.typeFullName.MUNICIPALITY")}
                </span>
              )}
              <span className="mt-1.5 block text-xs text-gray-500">
                {t("locations.typeHint")}
              </span>
            </label>

            <label>
              <span className={labelClass}>{t("locations.code")}</span>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm({
                    ...form,
                    // Code là chuỗi chữ số, giữ nguyên số 0 đầu
                    code: event.target.value.replace(/\D/g, ""),
                  })
                }
                className={inputClass}
                placeholder={
                  isLeafLocationType(form.type) ? "26506" : "79"
                }
                inputMode="numeric"
                maxLength={expectedCodeLength(form.type)}
                required
              />
              <span className="mt-1.5 block text-xs text-gray-500">
                {t("locations.codeDigitsHint", {
                  count: expectedCodeLength(form.type),
                })}
              </span>
            </label>

            {isLeafLocationType(form.type) && (
              <label className="sm:col-span-2">
                <span className={labelClass}>{t("locations.parent")}</span>
                <CustomSelect
                  aria-label={t("locations.parent")}
                  value={form.parentCode}
                  searchable
                  searchPlaceholder={tc("searchOptions", {
                    label: t("locations.parent"),
                  })}
                  emptyMessage={tc("noMatchingOptions")}
                  onChange={(event) =>
                    setForm({ ...form, parentCode: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">{t("locations.selectParent")}</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </CustomSelect>
                <span className="mt-1.5 block text-xs text-gray-500">
                  {t("locations.parentHint")}
                </span>
              </label>
            )}

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
              <Checkbox
                size="md"
                checked={form.isActive}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
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
