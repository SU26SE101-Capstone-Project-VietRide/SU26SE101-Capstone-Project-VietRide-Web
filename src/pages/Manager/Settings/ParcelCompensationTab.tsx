import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import InlineAlert from "../../../components/InlineAlert";
import { inputClass } from "../../../components/form/formClasses";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/toast/useToast";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import {
  getParcelCompensationPolicy,
  updateParcelCompensationPolicy,
  type ParcelCompensationPolicy,
  type ParcelCompensationPolicyDefaults,
} from "../../../api/vietride";
import {
  PARCEL_COMPENSATION_RANGES,
  draftFromParcelCompensationDefaults,
  draftFromParcelCompensationPolicy,
  isBelowPlatformDefault,
  parseParcelCompensationDraft,
  type ParcelCompensationDraft,
  type ParcelCompensationNumericField,
} from "../../../utils/parcelCompensationPolicy";
import { SettingsField } from "./SettingsField";

const AMOUNT_GROUP: ParcelCompensationNumericField[] = [
  "compensationRatePercent",
  "maxCompensationVnd",
  "noProofFallbackMultiplier",
];

const SLA_GROUP: ParcelCompensationNumericField[] = [
  "claimWindowDays",
  "searchSlaHours",
  "decisionSlaBusinessDays",
  "payoutSlaBusinessDays",
];

const emptyDraft: ParcelCompensationDraft = {
  compensationRatePercent: "",
  maxCompensationVnd: "",
  noProofFallbackMultiplier: "",
  claimWindowDays: "",
  searchSlaHours: "",
  decisionSlaBusinessDays: "",
  payoutSlaBusinessDays: "",
  belowDefaultAcknowledged: false,
};

/**
 * Tab bồi thường kiện hàng — `GET/PUT /v1/operator/policies/parcel-compensation`.
 *
 * Thuộc nhóm Reliability của Parcel nên tab chỉ được render khi cờ triển khai
 * nhà xe có module Parcel trong gói dịch vụ; phần gate nằm
 * ở `index.tsx`.
 *
 * Hai điểm nghiệp vụ UI phải nói rõ, nếu không nhà xe hiểu sai:
 *   • BE chụp ảnh policy vào từng Parcel lúc TẠO ĐƠN, nên sửa ở đây chỉ áp cho
 *     đơn mới — không hồi tố đơn đang tranh chấp (`effectiveForNewParcelsOnly`).
 *   • Hạ mức xuống dưới mặc định nền tảng phải tick xác nhận, không thì BE trả
 *     `422 POLICY_BELOW_DEFAULT_ACK_REQUIRED`.
 */
export default function ParcelCompensationTab() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const toast = useToast();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [policy, setPolicy] = useState<ParcelCompensationPolicy | null>(null);
  const [draft, setDraft] = useState<ParcelCompensationDraft>(emptyDraft);
  const [savedDraft, setSavedDraft] =
    useState<ParcelCompensationDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [invalidField, setInvalidField] =
    useState<ParcelCompensationNumericField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const startRequest = useLatestRequest();

  const loadPolicy = useCallback(async () => {
    const isLatest = startRequest();
    setLoading(true);
    setLoadError("");
    try {
      const result = await getParcelCompensationPolicy();
      if (!isLatest()) return;
      const nextDraft = draftFromParcelCompensationPolicy(result);
      setPolicy(result);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
    } catch (err) {
      if (!isLatest()) return;
      setLoadError(
        err instanceof Error
          ? err.message
          : tRef.current("settings.parcelCompensation.loadFailed"),
      );
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [startRequest]);

  useEffect(() => {
    queueMicrotask(() => void loadPolicy());
  }, [loadPolicy]);

  const clearErrors = () => {
    setValidationError("");
    setInvalidField(null);
  };

  const updateField = (field: ParcelCompensationNumericField, value: string) => {
    clearErrors();
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleUseDefaults = () => {
    if (!policy) return;
    clearErrors();
    setDraft(draftFromParcelCompensationDefaults(policy.platformDefaultPolicy));
  };

  const handleReset = () => {
    clearErrors();
    setDraft(savedDraft);
  };

  const handleSave = async () => {
    if (!policy || isSaving) return;

    const parsed = parseParcelCompensationDraft(
      draft,
      policy.platformDefaultPolicy,
    );
    if (!parsed.ok) {
      setInvalidField(parsed.field ?? null);
      setValidationError(
        parsed.field
          ? t(`settings.parcelCompensation.errors.${parsed.error}`, {
              field: t(`settings.parcelCompensation.fields.${parsed.field}`),
              min: PARCEL_COMPENSATION_RANGES[parsed.field].min,
              max: PARCEL_COMPENSATION_RANGES[parsed.field].max,
            })
          : t(`settings.parcelCompensation.errors.${parsed.error}`),
      );
      return;
    }

    setIsSaving(true);
    clearErrors();
    try {
      const updated = await updateParcelCompensationPolicy(parsed.value);
      const nextDraft = draftFromParcelCompensationPolicy(updated);
      setPolicy(updated);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      toast.success(t("settings.parcelCompensation.saveSuccess"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("settings.parcelCompensation.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const defaults: ParcelCompensationPolicyDefaults | null =
    policy?.platformDefaultPolicy ?? null;
  const belowDefault = defaults
    ? isBelowPlatformDefault(draft, defaults)
    : false;

  /**
   * Hint của mỗi ô = mức chung của VietRide, và chỉ với vài ô mới kèm thêm một
   * câu giải thích.
   *
   * Cố tình KHÔNG lặp lại thứ nhãn đã nói: "Tỉ lệ đền %", "Đền tối đa một vụ đ",
   * "Hạn trả lời khách ngày làm việc" tự nó đã đủ nghĩa, thêm một câu diễn giải
   * bên dưới chỉ làm 7 ô thành một bức tường chữ và người dùng bỏ đọc hết. Chỉ
   * hai ô còn hint (xem `fieldHints` trong file dịch) vì nhãn của chúng không
   * nói ra được phép nhân tiền cước và hệ quả "coi như mất".
   *
   * Khoảng nhập được cũng không hiện sẵn: nó chỉ có ích đúng lúc nhập sai, và
   * lúc đó `errors.out-of-range` đã ghi rõ "chỉ nhận từ {min} đến {max}".
   */
  const fieldHint = (field: ParcelCompensationNumericField) => {
    const explain = t(`settings.parcelCompensation.fieldHints.${field}`, {
      defaultValue: "",
    });
    if (!defaults) return explain || undefined;

    // Trần đền không có giới hạn trên về nghiệp vụ (BE chỉ đòi > 0) — đừng khoe
    // con số chặn kỹ thuật 999 tỉ ra cho người dùng đọc.
    const standard =
      field === "maxCompensationVnd"
        ? t("settings.parcelCompensation.defaultHintNoMax", {
            value: formatCurrency(defaults[field]),
          })
        : t("settings.parcelCompensation.defaultHint", {
            // Kèm đơn vị, nếu không câu "mức chung là 4" chẳng nói lên gì.
            value:
              field === "compensationRatePercent"
                ? `${defaults[field]}${t(`settings.parcelCompensation.units.${field}`)}`
                : `${defaults[field]} ${t(`settings.parcelCompensation.units.${field}`)}`,
          });

    return [explain, standard].filter(Boolean).join(" ");
  };

  const renderField = (field: ParcelCompensationNumericField) => (
    <SettingsField
      key={field}
      label={t(`settings.parcelCompensation.fields.${field}`)}
      required
      hint={fieldHint(field)}
    >
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={PARCEL_COMPENSATION_RANGES[field].min}
          max={PARCEL_COMPENSATION_RANGES[field].max}
          step={1}
          value={draft[field]}
          disabled={loading || !policy}
          aria-label={t(`settings.parcelCompensation.fields.${field}`)}
          aria-invalid={invalidField === field}
          onChange={(event) => updateField(field, event.target.value)}
          className={
            invalidField === field
              ? `${inputClass} border-red-300`
              : inputClass
          }
        />
        <span className="shrink-0 text-sm text-gray-500">
          {t(`settings.parcelCompensation.units.${field}`)}
        </span>
      </div>
    </SettingsField>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 max-w-2xl">
        <h3 className="text-base font-semibold text-gray-800">
          {loading ? tc("loading") : t("settings.parcelCompensation.title")}
        </h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          {t("settings.parcelCompensation.hint")}
        </p>
      </div>

      {/* Tải hỏng là mọi ô bị khoá (không có mức nền tảng thì không validate
          được luật "hạ dưới mặc định"), nên phải có lối thử lại tại chỗ. */}
      {loadError ? (
        <div className="mb-4">
          <InlineAlert tone="error">
            <p>{loadError}</p>
            <div className="mt-2">
              <Button size="sm" onClick={() => void loadPolicy()}>
                {tc("retry")}
              </Button>
            </div>
          </InlineAlert>
        </div>
      ) : null}

      {policy ? (
        <div className="mb-5">
          <InlineAlert tone="info">
            <p>{t("settings.parcelCompensation.newParcelsOnly")}</p>
            <p className="mt-1 text-xs">
              {policy.updatedAt
                ? t("settings.parcelCompensation.versionLine", {
                    version: policy.version,
                    updatedAt: formatDateTime(policy.updatedAt),
                  })
                : t("settings.parcelCompensation.neverConfigured")}
            </p>
          </InlineAlert>
        </div>
      ) : null}

      {validationError ? (
        <div className="mb-4">
          <InlineAlert tone="error">
            <p>{validationError}</p>
          </InlineAlert>
        </div>
      ) : null}

      <div className="space-y-6">
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-800">
            {t("settings.parcelCompensation.amountGroup")}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {AMOUNT_GROUP.map(renderField)}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-800">
            {t("settings.parcelCompensation.slaGroup")}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SLA_GROUP.map(renderField)}
          </div>
        </div>

        {/* Công thức của BE (ParcelCompensationCalculator) viết lại bằng con số
            đang nhập — nhà xe thấy ngay hệ quả trước khi bấm lưu. */}
        <div className="rounded-xl bg-vr-50 px-4 py-3">
          <p className="text-xs font-semibold text-vr-800">
            {t("settings.parcelCompensation.summaryTitle")}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-gray-700">
            <li>
              {t("settings.parcelCompensation.summaryWithProof", {
                rate: draft.compensationRatePercent || "—",
                cap: draft.maxCompensationVnd
                  ? formatCurrency(draft.maxCompensationVnd)
                  : "—",
              })}
            </li>
            <li>
              {t("settings.parcelCompensation.summaryNoProof", {
                multiplier: draft.noProofFallbackMultiplier || "—",
                cap: draft.maxCompensationVnd
                  ? formatCurrency(draft.maxCompensationVnd)
                  : "—",
              })}
            </li>
            <li>{t("settings.parcelCompensation.summaryFreight")}</li>
          </ul>
        </div>

        {belowDefault ? (
          <InlineAlert tone="warning">
            <p>{t("settings.parcelCompensation.belowDefaultWarning")}</p>
            <label className="mt-2 flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.belowDefaultAcknowledged}
                onChange={(event) => {
                  clearErrors();
                  setDraft((prev) => ({
                    ...prev,
                    belowDefaultAcknowledged: event.target.checked,
                  }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>{t("settings.parcelCompensation.belowDefaultAck")}</span>
            </label>
          </InlineAlert>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
        <Button
          variant="ghost"
          onClick={handleUseDefaults}
          disabled={loading || !policy}
        >
          {t("settings.parcelCompensation.useDefaults")}
        </Button>
        <Button variant="secondary" onClick={handleReset} disabled={loading}>
          {t("settings.undo")}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={loading || !policy || isSaving}
        >
          {t("settings.parcelCompensation.save")}
        </Button>
      </div>
    </div>
  );
}
