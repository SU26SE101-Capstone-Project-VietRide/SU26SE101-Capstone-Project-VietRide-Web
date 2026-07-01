import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiBox, FiEdit2, FiPlus, FiPower, FiTrash2 } from "react-icons/fi";
import Modal from "../../components/Modal";
import { packages as mockPackages, type Package } from "../../data/mockData";

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function Packages() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const handleEdit = (pkg: Package) => {
    setSelectedPackage(pkg);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("packages.deleteConfirm"))) {
      alert(t("packages.deleteSuccess", { id }));
    }
  };

  const handleToggleActive = (id: string) => {
    alert(t("packages.toggleSuccess", { id }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("packages.title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("packages.subtitleLong")}</p>
        </div>
        <div
          onClick={() => {
            setSelectedPackage(null);
            setCreateOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <FiPlus size={16} /> {t("packages.create")}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPackages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {t("packages.packageLabel")}
                </p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {pkg.name}
                </h3>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  pkg.active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {pkg.active ? tc("active") : tc("inactive")}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-vr-600">
                  {formatNumber(pkg.price)}
                </span>
                <span className="text-gray-600 ml-2">
                  {t("packages.perMonth", { months: pkg.duration })}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <FiBox size={16} className="text-vr-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">
                    {t("packages.vehicleCount")}
                  </p>
                  <p className="font-semibold text-gray-900">
                    {t("packages.maxVehicles", { count: pkg.maxVehicles })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FiBox size={16} className="text-vr-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">
                    {t("packages.routesLabel")}
                  </p>
                  <p className="font-semibold text-gray-900">
                    {t("packages.maxRoutes", { count: pkg.maxRoutes })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-gray-600 font-medium mb-2">
                {t("packages.features")}
              </p>
              <ul className="space-y-1">
                {pkg.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 flex items-start gap-2"
                  >
                    <span className="text-vr-500 mt-1">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => handleToggleActive(pkg.id)}
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                title={pkg.active ? tc("disable") : tc("enable")}
                aria-label={pkg.active ? tc("disable") : tc("enable")}
              >
                <FiPower size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleEdit(pkg)}
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-vr-200 text-vr-600 transition hover:bg-vr-50 hover:text-vr-700"
                title={tc("edit")}
                aria-label={tc("edit")}
              >
                <FiEdit2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(pkg.id)}
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                title={tc("delete")}
                aria-label={tc("delete")}
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedPackage(null);
        }}
        wide
        icon={<FiBox size={20} />}
        title={
          selectedPackage
            ? t("packages.editModalTitle")
            : t("packages.createModalTitle")
        }
        subtitle={
          selectedPackage
            ? t("packages.editSubtitle")
            : t("packages.createSubtitle")
        }
        footer={
          <>
            <div
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedPackage(null);
              }}
              className="rounded-lg border border-gray-200 cursor-pointer bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </div>
            <div
              onClick={() => {
                alert(
                  t("packages.saveSuccess", {
                    action: selectedPackage
                      ? tc("update")
                      : tc("create"),
                  }),
                );
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedPackage(null);
              }}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {t("packages.savePackage", {
                action: selectedPackage ? tc("update") : tc("create"),
              })}
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("packages.packageName")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedPackage?.name || "Gói Basic"}
                placeholder="VD: Gói Professional"
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("packages.packagePrice")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.price || ""}
                placeholder="VD: 1000000"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={inputClass + " min-h-[80px]"}
              defaultValue={selectedPackage?.description || ""}
              placeholder={t("packages.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("packages.maxVehiclesLabel")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.maxVehicles || ""}
                placeholder="VD: 5"
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("packages.maxRoutesLabel")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.maxRoutes || ""}
                placeholder="VD: 3"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {t("packages.durationLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              type="number"
              defaultValue={selectedPackage?.duration || "3"}
              placeholder="VD: 3"
            />
          </div>

          <div>
            <label className={labelClass}>{t("packages.featuresLabel")}</label>
            <textarea
              className={inputClass + " min-h-[120px]"}
              defaultValue={
                selectedPackage?.features.join("\n") ||
                "Tối đa 5 xe\nTối đa 3 tuyến đường\nHỗ trợ cơ bản"
              }
              placeholder={t("packages.featuresPlaceholder")}
              rows={5}
            />
          </div>

          <div>
            <p className={labelClass}>{t("packages.activatePackage")}</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked="true"
                className="relative h-7 w-12 shrink-0 rounded-full bg-vr-500"
              >
                <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
              </button>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {t("packages.activatePackageTitle")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("packages.activatePackageHint")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">{t("packages.voucherNote")}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
