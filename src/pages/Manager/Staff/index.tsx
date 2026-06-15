import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { staffMembers, type StaffMember } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function StaffPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const filtered = useMemo(
    () =>
      staffMembers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.phone.replace(/\s/g, "").includes(search.replace(/\s/g, "")),
      ),
    [search],
  );

  const totalStaff = 86;

  function roleLabel(r: StaffMember["role"]) {
    if (r === "driver") return t("staff.driver");
    if (r === "dispatcher") return t("staff.dispatcher");
    return t("staff.seller");
  }

  function statusBadge(s: StaffMember["status"]) {
    if (s === "on_duty")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t("staff.onDuty")}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {t("staff.onLeave")}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("staff.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("staff.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("staff.add")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("staff.total")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{totalStaff}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 2.4%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiUser size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("staff.onDuty")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">54</p>
              <p className="mt-2 text-xs text-gray-500">62.8%</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("staff.drivers")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">42</p>
              <p className="mt-2 text-xs text-gray-500">
                {t("staff.fromTotal", { total: totalStaff })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FiUser size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("staff.needsAction")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">3</p>
              <p className="mt-2 text-xs text-gray-500">
                {t("staff.expiringContracts")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FiUser size={20} />
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
              placeholder={t("staff.searchPlaceholder")}
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
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("staff.fullName")}</th>
                <th className="px-5 py-3">{t("staff.role")}</th>
                <th className="px-5 py-3">{t("staff.phoneShort")}</th>
                <th className="px-5 py-3">{t("staff.license")}</th>
                <th className="px-5 py-3">{t("staff.tripsRun")}</th>
                <th className="px-5 py-3">{t("staff.rating")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vr-100 text-vr-700">
                        <FiUser size={16} />
                      </div>
                      <span className="font-semibold text-gray-900">
                        {s.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {roleLabel(s.role)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{s.phone}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {s.license ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {s.trips}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-800">
                    <span className="text-amber-500">★</span> {s.rating}
                  </td>
                  <td className="px-5 py-4">{statusBadge(s.status)}</td>
                  <td className="px-5 py-4 text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStaff(s);
                        setOpenEdit(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {tc("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t("staff.confirmSuspend"))) {
                          alert(t("staff.suspendSuccess"));
                        }
                      }}
                      className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {t("staff.suspend")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t("staff.confirmDeleteStaff"))) {
                          alert(t("staff.deleteSuccess"));
                        }
                      }}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      {tc("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {tc("showingItems", { count: filtered.length, total: totalStaff })}
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
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        wide
        icon={<FiUser size={20} />}
        title={t("staff.addTitle")}
        subtitle={t("staff.addSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenAdd(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => setOpenAdd(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("staff.createProfile")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("staff.personalInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("staff.fullNameLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className={labelClass}>{t("staff.birthDate")}</label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("staff.idNumber")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="079..." />
              </div>
              <div>
                <label className={labelClass}>{t("staff.gender")}</label>
                <select className={inputClass} defaultValue="male">
                  <option value="male">{t("staff.male")}</option>
                  <option value="female">{t("staff.female")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0901 234 567" />
              </div>
              <div>
                <label className={labelClass}>{tc("email")}</label>
                <input className={inputClass} type="email" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("staff.assignment")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("staff.role")} <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="driver">
                  <option value="driver">{t("staff.driver")}</option>
                  <option value="dispatcher">{t("staff.dispatcher")}</option>
                  <option value="seller">{t("staff.seller")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("staff.shift")}</label>
                <select className={inputClass} defaultValue="morning">
                  <option value="morning">{t("staff.morningShift")}</option>
                  <option value="evening">{t("staff.eveningShift")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {t("staff.licenseClass")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="E">
                  <option>E</option>
                  <option>D</option>
                  <option>B2</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {t("staff.licenseExpiry")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>{t("staff.baseSalary")}</label>
                <input className={inputClass} placeholder="12000000" />
              </div>
              <div>
                <label className={labelClass}>{t("staff.startDate")}</label>
                <input className={inputClass} type="date" />
              </div>
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        wide
        icon={<FiUser size={20} />}
        title={t("staff.editTitle")}
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
                alert(t("staff.updateSuccess"));
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              {t("staff.saveChanges")}
            </button>
          </>
        }
      >
        {selectedStaff && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                {t("staff.personalInfo")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("staff.fullNameLabel")}</label>
                  <input className={inputClass} defaultValue={selectedStaff.name} />
                </div>
                <div>
                  <label className={labelClass}>{t("staff.idNumber")}</label>
                  <input className={inputClass} defaultValue={selectedStaff.id} disabled />
                </div>
                <div>
                  <label className={labelClass}>{tc("phone")}</label>
                  <input className={inputClass} defaultValue={selectedStaff.phone} />
                </div>
                <div>
                  <label className={labelClass}>{tc("email")}</label>
                  <input className={inputClass} placeholder="email@example.com" />
                </div>
              </div>
            </section>
            <div className="border-t border-gray-100" />
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                {t("staff.assignment")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("staff.role")}</label>
                  <select className={inputClass} defaultValue={selectedStaff.role}>
                    <option value="driver">{t("staff.driver")}</option>
                    <option value="dispatcher">{t("staff.dispatcher")}</option>
                    <option value="seller">{t("staff.seller")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{tc("status")}</label>
                  <select className={inputClass} defaultValue={selectedStaff.status}>
                    <option value="on_duty">{t("staff.onDuty")}</option>
                    <option value="on_leave">{t("staff.onLeave")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("staff.license")}</label>
                  <input className={inputClass} defaultValue={selectedStaff.license || ""} />
                </div>
                <div>
                  <label className={labelClass}>{t("staff.licenseExpiry")}</label>
                  <input className={inputClass} type="date" />
                </div>
              </div>
            </section>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">{t("staff.statsLabel")}</span>{" "}
                {t("staff.statsSummary", {
                  trips: selectedStaff.trips,
                  rating: selectedStaff.rating,
                })}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
