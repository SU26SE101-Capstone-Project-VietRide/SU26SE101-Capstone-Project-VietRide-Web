import { useToastFeedback } from "../../hooks/useToastFeedback";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiBox, FiEdit2, FiPlus, FiPower } from "react-icons/fi";
import CurrencyInput from "../../components/CurrencyInput";
import Modal from "../../components/Modal";
import {
  createAdminSubscriptionPlan,
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
  type AdminSubscriptionPlanRequest,
  type SubscriptionPlan,
} from "../../api/vietride";
import { toNumber } from "../../utils/number";
import { formatCurrency } from "../../utils/currency";
import { inputClass, labelClass } from "../../components/form/formClasses";

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

const emptyForm: AdminSubscriptionPlanRequest = {
  name: "",
  description: "",
  pricePerMonth: 0,
  pricePerYear: 0,
  maxVehicles: 0,
  maxDrivers: 0,
  maxAssistants: 0,
  maxOperatorUsers: 0,
  maxRoutes: 0,
  maxTripsPerMonth: 0,
  enableParcel: true,
  enableShuttle: true,
  enableRag: false,
  isActive: true,
};

function planToRequest(
  plan: SubscriptionPlan,
  isActive = plan.isActive,
): AdminSubscriptionPlanRequest {
  return {
    name: plan.name,
    description: plan.description ?? "",
    pricePerMonth: plan.pricePerMonth,
    pricePerYear: plan.pricePerYear,
    maxVehicles: plan.limits.maxVehicles,
    maxDrivers: plan.limits.maxDrivers,
    maxAssistants: plan.limits.maxAssistants,
    maxOperatorUsers: plan.limits.maxOperatorUsers,
    maxRoutes: plan.limits.maxRoutes,
    maxTripsPerMonth: plan.limits.maxTripsPerMonth,
    enableParcel: plan.modules.enableParcel,
    enableShuttle: plan.modules.enableShuttle,
    enableRag: plan.modules.enableRag,
    isActive,
  };
}

export default function Packages() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [modalOpen, setModalOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [form, setForm] = useState<AdminSubscriptionPlanRequest>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Một loader duy nhất dùng chung cho lần load đầu (effect) và sau các mutation
  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminSubscriptionPlans({ includeInactive: true });
      setPlans(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("packages.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadPlans();
    });

    return () => {
      cancelled = true;
    };
  }, [loadPlans]);

  function openCreate() {
    setSelectedPlan(null);
    setForm(emptyForm);
    setModalOpen(true);
    setFormError("");
    setMessage("");
  }

  function openEdit(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setForm(planToRequest(plan));
    setModalOpen(true);
    setFormError("");
    setMessage("");
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedPlan(null);
    setFormError("");
  }

  function updateForm<K extends keyof AdminSubscriptionPlanRequest>(
    key: K,
    value: AdminSubscriptionPlanRequest[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePlan() {
    const resourceLimits = [
      form.maxVehicles,
      form.maxDrivers,
      form.maxAssistants,
      form.maxOperatorUsers,
      form.maxRoutes,
      form.maxTripsPerMonth,
    ];

    if (!form.name.trim()) {
      setFormError(t("packages.nameRequired"));
      return;
    }

    if (form.pricePerMonth < 0 || form.pricePerYear < 0) {
      setFormError(t("packages.priceNonNegative"));
      return;
    }

    if (resourceLimits.some((value) => !Number.isInteger(value) || value <= 0)) {
      setFormError(t("packages.limitsPositive"));
      return;
    }

    setIsSaving(true);
    setFormError("");
    const request = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    };

    try {
      if (selectedPlan) {
        await updateAdminSubscriptionPlan(selectedPlan.planId, request);
      } else {
        await createAdminSubscriptionPlan(request);
      }

      setMessage(
        t("packages.saveSuccess", {
          action: selectedPlan ? tc("update") : tc("create"),
        }),
      );
      closeModal();
      await loadPlans();
    } catch {
      setFormError(t("packages.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(plan: SubscriptionPlan) {
    setError("");
    setMessage("");

    try {
      await updateAdminSubscriptionPlan(plan.planId, planToRequest(plan, !plan.isActive));
      setMessage(t("packages.toggleSuccess", { id: plan.planId }));
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("packages.saveFailed"));
    }
  }

  const moduleFeatures: Array<{
    key: keyof SubscriptionPlan["modules"];
    label: string;
    description: string;
  }> = [
    {
      key: "enableParcel",
      label: t("packages.parcelModule"),
      description: t("packages.parcelModuleHint"),
    },
    {
      key: "enableShuttle",
      label: t("packages.shuttleModule"),
      description: t("packages.shuttleModuleHint"),
    },
    {
      key: "enableRag",
      label: t("packages.ragModule"),
      description: t("packages.ragModuleHint"),
    },
  ];

  useToastFeedback({ message, error: error || formError });
  if (isLoading && plans.length === 0 && !error) {
    return <PackagesPageSkeleton loadingLabel={t("packages.loading")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("packages.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("packages.subtitleLong")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 font-medium text-white transition hover:bg-vr-600"
        >
          <FiPlus size={16} /> {t("packages.create")}
        </button>
      </div>


      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.planId}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  {t("packages.packageLabel")}
                </p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {plan.name}
                </h3>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                  plan.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {plan.isActive ? tc("active") : tc("inactive")}
              </span>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              {plan.description || "-"}
            </p>

            <div className="mb-6 border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-500">
                {t("packages.monthlyPrice")}
              </p>
              <p className="text-3xl font-bold text-vr-600">
                {formatCurrency(plan.pricePerMonth)}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t("packages.yearlyPrice")}:{" "}
                <span className="font-semibold text-gray-900">
                  {formatCurrency(plan.pricePerYear)}
                </span>
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <Limit label={t("packages.vehicleCount")} value={plan.limits.maxVehicles} />
              <Limit label={t("packages.routesLabel")} value={plan.limits.maxRoutes} />
              <Limit label={t("packages.maxDriversLabel")} value={plan.limits.maxDrivers} />
              <Limit label={t("packages.maxTripsLabel")} value={plan.limits.maxTripsPerMonth} />
            </div>

            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-gray-600">
                {t("packages.features")}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {moduleFeatures.map((feature) => {
                  const enabled = plan.modules[feature.key];
                  return (
                    <span
                      key={feature.key}
                      className={`rounded-full px-2 py-1 font-semibold ${
                        enabled ? "bg-vr-50 text-vr-700" : "bg-gray-100 text-gray-500"
                      }`}
                      title={feature.description}
                    >
                      {feature.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => void toggleActive(plan)}
                className="table-action-button"
                title={plan.isActive ? tc("disable") : tc("enable")}
                aria-label={plan.isActive ? tc("disable") : tc("enable")}
              >
                <FiPower size={16} />
              </button>
              <button
                type="button"
                onClick={() => openEdit(plan)}
                className="table-action-button"
                title={tc("edit")}
                aria-label={tc("edit")}
              >
                <FiEdit2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        wide
        icon={<FiBox size={20} />}
        title={
          selectedPlan
            ? t("packages.editModalTitle")
            : t("packages.createModalTitle")
        }
        subtitle={
          selectedPlan ? t("packages.editSubtitle") : t("packages.createSubtitle")
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void savePlan()}
              disabled={isSaving}
              className="cursor-pointer rounded-xl bg-vr-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("packages.savePackage", {
                action: selectedPlan ? tc("update") : tc("create"),
              })}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h3 className="text-base font-bold tracking-tight text-slate-900">{t("packages.packageInfoTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("packages.packageInfoHint")}</p></div>
            <div className="space-y-4"><TextInput label={t("packages.packageName")} value={form.name} onChange={(value) => updateForm("name", value)} /><div><label className={labelClass}>{tc("description")}</label><textarea className={inputClass + " min-h-[96px] resize-y"} value={form.description} placeholder={t("packages.descriptionPlaceholder")} onChange={(event) => updateForm("description", event.target.value)} rows={3} /></div></div>
          </section>
          <section className="rounded-2xl border border-vr-100 bg-vr-50/50 p-5">
            <div className="mb-4"><h3 className="text-base font-bold tracking-tight text-slate-900">{t("packages.pricingTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("packages.pricingHint")}</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><CurrencyField label={t("packages.monthlyPrice")} value={form.pricePerMonth} onChange={(value) => updateForm("pricePerMonth", value)} /><CurrencyField label={t("packages.yearlyPrice")} value={form.pricePerYear} onChange={(value) => updateForm("pricePerYear", value)} /></div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-4"><h3 className="text-base font-bold tracking-tight text-slate-900">{t("packages.limitsTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("packages.limitsHint")}</p></div>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"><NumberField label={t("packages.maxVehiclesLabel")} value={form.maxVehicles} onChange={(value) => updateForm("maxVehicles", value)} /><NumberField label={t("packages.maxRoutesLabel")} value={form.maxRoutes} onChange={(value) => updateForm("maxRoutes", value)} /><NumberField label={t("packages.maxDriversLabel")} value={form.maxDrivers} onChange={(value) => updateForm("maxDrivers", value)} /><NumberField label={t("packages.maxAssistantsLabel")} value={form.maxAssistants} onChange={(value) => updateForm("maxAssistants", value)} /><NumberField label={t("packages.maxOperatorUsersLabel")} value={form.maxOperatorUsers} onChange={(value) => updateForm("maxOperatorUsers", value)} /><NumberField label={t("packages.maxTripsLabel")} value={form.maxTripsPerMonth} onChange={(value) => updateForm("maxTripsPerMonth", value)} /></div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h3 className="text-base font-bold tracking-tight text-slate-900">{t("packages.modulesTitle")}</h3><p className="mt-1 text-sm text-slate-500">{t("packages.modulesHint")}</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><Toggle label={t("packages.parcelModule")} description={t("packages.parcelModuleHint")} checked={form.enableParcel} onChange={(value) => updateForm("enableParcel", value)} /><Toggle label={t("packages.shuttleModule")} description={t("packages.shuttleModuleHint")} checked={form.enableShuttle} onChange={(value) => updateForm("enableShuttle", value)} /><Toggle label={t("packages.ragModule")} description={t("packages.ragModuleHint")} checked={form.enableRag} onChange={(value) => updateForm("enableRag", value)} /><Toggle label={t("packages.activatePackage")} description={t("packages.activatePackageHint")} checked={form.isActive} onChange={(value) => updateForm("isActive", value)} /></div>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{formatNumber(value)}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        type="number"
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </div>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <CurrencyInput
        className={inputClass}
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`group flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition ${checked ? "border-vr-200 bg-vr-50" : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-gray-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-vr-600 accent-vr-600 focus:ring-vr-500"
      />
    </label>
  );
}


function PackageSkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

function PackagesPageSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-6" role="status" aria-label={loadingLabel} data-testid="packages-page-skeleton">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-3xl space-y-2">
          <PackageSkeletonBlock className="h-9 w-72" />
          <PackageSkeletonBlock className="h-5 w-full" />
        </div>
        <PackageSkeletonBlock className="h-10 w-36 shrink-0" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="w-2/3 space-y-2">
                <PackageSkeletonBlock className="h-3 w-24" />
                <PackageSkeletonBlock className="h-7 w-full" />
              </div>
              <PackageSkeletonBlock className="h-6 w-20" />
            </div>
            <PackageSkeletonBlock className="h-12 w-full" />
            <PackageSkeletonBlock className="h-20 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <PackageSkeletonBlock className="h-10 w-full" />
              <PackageSkeletonBlock className="h-10 w-full" />
              <PackageSkeletonBlock className="h-10 w-full" />
              <PackageSkeletonBlock className="h-10 w-full" />
            </div>
            <PackageSkeletonBlock className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
