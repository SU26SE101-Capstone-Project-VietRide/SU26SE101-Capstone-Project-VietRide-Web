import { useEffect, useState } from "react";
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

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPlans() {
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
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialPlans() {
      try {
        const result = await getAdminSubscriptionPlans({ includeInactive: true });
        if (isCurrent) {
          setPlans(result);
        }
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : t("packages.loadFailed"));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialPlans();

    return () => {
      isCurrent = false;
    };
  }, [t]);

  function openCreate() {
    setSelectedPlan(null);
    setForm(emptyForm);
    setModalOpen(true);
    setError("");
    setMessage("");
  }

  function openEdit(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setForm(planToRequest(plan));
    setModalOpen(true);
    setError("");
    setMessage("");
  }

  function updateForm<K extends keyof AdminSubscriptionPlanRequest>(
    key: K,
    value: AdminSubscriptionPlanRequest[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePlan() {
    setIsSaving(true);
    setError("");

    try {
      if (selectedPlan) {
        await updateAdminSubscriptionPlan(selectedPlan.planId, form);
      } else {
        await createAdminSubscriptionPlan(form);
      }

      setMessage(
        t("packages.saveSuccess", {
          action: selectedPlan ? tc("update") : tc("create"),
        }),
      );
      setModalOpen(false);
      setSelectedPlan(null);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("packages.saveFailed"));
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

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("packages.loading")}
        </div>
      ) : null}

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
                {formatNumber(plan.pricePerMonth)} VND
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t("packages.yearlyPrice")}:{" "}
                <span className="font-semibold text-gray-900">
                  {formatNumber(plan.pricePerYear)} VND
                </span>
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <Limit label={t("packages.vehicleCount")} value={plan.limits.maxVehicles} />
              <Limit label={t("packages.routesLabel")} value={plan.limits.maxRoutes} />
              <Limit label={t("packages.maxDriversLabel")} value={plan.limits.maxDrivers} />
              <Limit label={t("packages.maxTripsLabel")} value={plan.limits.maxTripsPerMonth} />
            </div>

            <div className="mb-6 flex flex-wrap gap-2 text-xs">
              {Object.entries(plan.modules).map(([key, enabled]) => (
                <span
                  key={key}
                  className={`rounded-full px-2 py-1 font-semibold ${
                    enabled ? "bg-vr-50 text-vr-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {key}
                </span>
              ))}
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
        onClose={() => {
          setModalOpen(false);
          setSelectedPlan(null);
        }}
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
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void savePlan()}
              disabled={isSaving}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("packages.savePackage", {
                action: selectedPlan ? tc("update") : tc("create"),
              })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t("packages.packageName")}
              value={form.name}
              onChange={(value) => updateForm("name", value)}
            />
            <CurrencyField
              label={t("packages.monthlyPrice")}
              value={form.pricePerMonth}
              onChange={(value) => updateForm("pricePerMonth", value)}
            />
            <CurrencyField
              label={t("packages.yearlyPrice")}
              value={form.pricePerYear}
              onChange={(value) => updateForm("pricePerYear", value)}
            />
          </div>

          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label={t("packages.maxVehiclesLabel")} value={form.maxVehicles} onChange={(value) => updateForm("maxVehicles", value)} />
            <NumberField label={t("packages.maxRoutesLabel")} value={form.maxRoutes} onChange={(value) => updateForm("maxRoutes", value)} />
            <NumberField label={t("packages.maxDriversLabel")} value={form.maxDrivers} onChange={(value) => updateForm("maxDrivers", value)} />
            <NumberField label={t("packages.maxAssistantsLabel")} value={form.maxAssistants} onChange={(value) => updateForm("maxAssistants", value)} />
            <NumberField label={t("packages.maxOperatorUsersLabel")} value={form.maxOperatorUsers} onChange={(value) => updateForm("maxOperatorUsers", value)} />
            <NumberField label={t("packages.maxTripsLabel")} value={form.maxTripsPerMonth} onChange={(value) => updateForm("maxTripsPerMonth", value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Parcel" checked={form.enableParcel} onChange={(value) => updateForm("enableParcel", value)} />
            <Toggle label="Shuttle" checked={form.enableShuttle} onChange={(value) => updateForm("enableShuttle", value)} />
            <Toggle label="RAG" checked={form.enableRag} onChange={(value) => updateForm("enableRag", value)} />
            <Toggle label={t("packages.activatePackage")} checked={form.isActive} onChange={(value) => updateForm("isActive", value)} />
          </div>
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
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-sm font-semibold text-gray-800">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
      />
    </label>
  );
}
