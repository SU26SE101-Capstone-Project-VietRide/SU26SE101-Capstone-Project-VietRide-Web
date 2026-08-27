import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import InlineAlert from "../../../components/InlineAlert";
import { inputClass } from "../../../components/form/formClasses";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/toast/useToast";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import {
  getOperatorProfile,
  updateOperatorProfile,
  type OperatorProfile,
} from "../../../api/vietride";
import {
  buildCancellationWindows,
  createCancellationPolicyDraft,
  draftsFromCancellationPolicy,
  draftsFromCancellationTemplate,
  parseCancellationPolicyDrafts,
  previewFeePercent,
  type CancellationPolicyDraft,
  type CancellationWindow,
} from "../../../utils/operatorCancellationPolicy";

function windowTitle(window: CancellationWindow, t: TFunction) {
  if (window.toInclusive === null && window.fromExclusive === null) {
    return t("settings.cancellation.alwaysFullRefund");
  }
  if (window.toInclusive === null) {
    return t("settings.cancellation.windowAfter", {
      hours: window.fromExclusive ?? 0,
    });
  }
  if (window.fromExclusive === null) {
    return t("settings.cancellation.windowWithin", {
      hours: window.toInclusive,
    });
  }
  return t("settings.cancellation.windowBetween", {
    from: window.fromExclusive,
    to: window.toInclusive,
  });
}

function refundLabel(feePercent: number, t: TFunction) {
  if (feePercent >= 100) return t("settings.cancellation.refundNone");
  if (feePercent <= 0) return t("settings.cancellation.refundFull");
  return t("settings.cancellation.refundAmount", { refund: 100 - feePercent });
}

/**
 * Tab chính sách hoàn vé. Thuộc màn Cấu hình chứ không phải Hồ sơ: đây là luật
 * kinh doanh của nhà xe, cùng nhóm với phụ thu theo dịp. BE vẫn để nó trong
 * `PATCH /v1/operator/profile`, nên tab này phải tải cả hồ sơ rồi gửi lại
 * nguyên các trường khác — `cancellationPolicy` là thứ duy nhất nó đổi.
 */
export default function CancellationPolicyTab() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const toast = useToast();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [operator, setOperator] = useState<OperatorProfile | null>(null);
  const [drafts, setDrafts] = useState<CancellationPolicyDraft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<CancellationPolicyDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Bậc vừa được thêm. Danh sách bậc nằm dưới nút "Thêm bậc" và có thể dài hơn
  // màn hình, nên bấm xong không thấy gì đổi — phải tự cuộn xuống mới biết đã
  // thêm. Giữ id ở đây để vừa cuộn tới, vừa đánh dấu bằng viền sáng.
  const [addedRuleId, setAddedRuleId] = useState("");
  // Bậc đang chờ được cuộn tới + focus. Dùng ref (không phải state) vì việc này
  // chỉ chạy đúng một lần lúc node gắn vào DOM, không cần render lại.
  const pendingScrollIdRef = useRef("");
  const startRequest = useLatestRequest();

  const loadProfile = useCallback(async () => {
    const isLatest = startRequest();
    setLoading(true);
    setLoadError("");
    try {
      const profile = await getOperatorProfile();
      if (!isLatest()) return;
      const nextDrafts = draftsFromCancellationPolicy(
        profile.cancellationPolicy,
      );
      setOperator(profile);
      setDrafts(nextDrafts);
      setSavedDrafts(nextDrafts);
    } catch (err) {
      if (!isLatest()) return;
      setLoadError(
        err instanceof Error
          ? err.message
          : tRef.current("settings.cancellation.loadFailed"),
      );
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [startRequest]);

  useEffect(() => {
    queueMicrotask(() => void loadProfile());
  }, [loadProfile]);

  const updateRule = (
    id: string,
    field: "hoursBeforeDeparture" | "feePercent",
    value: string,
  ) => {
    setValidationError("");
    setDrafts((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)),
    );
  };

  const addRule = () => {
    const draft = createCancellationPolicyDraft();
    pendingScrollIdRef.current = draft.id;
    setValidationError("");
    setAddedRuleId(draft.id);
    setDrafts((prev) => [...prev, draft]);
  };

  /**
   * Callback ref cho thẻ bậc vừa thêm: cuộn tới nơi rồi đặt con trỏ vào ô đầu.
   *
   * Chạy ngay lúc React gắn node nên không cần effect. `preventScroll` để việc
   * focus không giật màn hình về vị trí khác, đè lên cú cuộn mượt vừa gọi.
   * `scrollIntoView` được gọi tuỳ chọn vì jsdom không cài đặt hàm này.
   */
  const focusAddedRule = useCallback((node: HTMLDivElement | null) => {
    if (!node || pendingScrollIdRef.current === "") {
      return;
    }

    pendingScrollIdRef.current = "";
    node.scrollIntoView?.({ behavior: "smooth", block: "center" });
    node.querySelector("input")?.focus({ preventScroll: true });
  }, []);

  const removeRule = (id: string) => {
    setValidationError("");
    setDrafts((prev) => prev.filter((rule) => rule.id !== id));
  };

  const applyTemplate = () => {
    setValidationError("");
    setDrafts(draftsFromCancellationTemplate());
  };

  const handleReset = () => {
    setValidationError("");
    setDrafts(savedDrafts);
  };

  const handleSave = async () => {
    if (!operator || isSaving) return;

    const parsedDrafts = parseCancellationPolicyDrafts(drafts);
    if (!parsedDrafts.ok) {
      setValidationError(
        t(`settings.cancellation.errors.${parsedDrafts.error}`),
      );
      return;
    }

    setIsSaving(true);
    setValidationError("");
    try {
      const updated = await updateOperatorProfile({
        name: operator.name,
        contactPhone: operator.contactPhone,
        logoUrl: operator.logoUrl ?? undefined,
        addressStreet: operator.address.street,
        addressWard: operator.address.ward,
        addressProvince: operator.address.province,
        representativeName: operator.representativeName,
        representativePhone: operator.representativePhone,
        cancellationPolicy: parsedDrafts.value,
        parcelNoShowPolicy: operator.parcelNoShowPolicy ?? null,
        luggagePolicy: operator.luggagePolicy ?? null,
      });
      const nextDrafts = draftsFromCancellationPolicy(
        updated.cancellationPolicy,
      );
      setOperator(updated);
      setDrafts(nextDrafts);
      setSavedDrafts(nextDrafts);
      toast.success(t("settings.cancellation.saveSuccess"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("settings.cancellation.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Tắt viền sáng sau khi người dùng đã kịp nhìn thấy. setState nằm trong
  // callback của timer (không phải thân effect) nên không vi phạm quy tắc hook.
  useEffect(() => {
    if (!addedRuleId) {
      return;
    }

    const timer = window.setTimeout(() => setAddedRuleId(""), 2_000);
    return () => window.clearTimeout(timer);
  }, [addedRuleId]);

  const parsed = parseCancellationPolicyDrafts(drafts);
  const windows = parsed.ok ? buildCancellationWindows(parsed.value) : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <h3 className="text-base font-semibold text-gray-800">
            {loading ? tc("loading") : t("settings.cancellation.title")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {t("settings.cancellation.hint")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {drafts.length === 0 ? (
            <Button onClick={applyTemplate} disabled={loading || !operator}>
              {t("settings.cancellation.useTemplate")}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={addRule}
            disabled={loading || !operator}
          >
            <FiPlus size={14} />
            {t("settings.cancellation.addTier")}
          </Button>
        </div>
      </div>

      {/* Tải hỏng là không sửa được gì (thiếu hồ sơ thì không PATCH lại được
          các trường khác), nên phải có lối thử lại tại chỗ. */}
      {loadError ? (
        <div className="mb-4">
          <InlineAlert tone="error">
            <p>{loadError}</p>
            <div className="mt-2">
              <Button size="sm" onClick={() => void loadProfile()}>
                {tc("retry")}
              </Button>
            </div>
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

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5">
          <p className="text-sm font-medium text-gray-800">
            {t("settings.cancellation.empty")}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {t("settings.cancellation.templateHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((rule, index) => {
            const feePercent = previewFeePercent(rule);
            return (
              <div
                key={rule.id}
                ref={rule.id === addedRuleId ? focusAddedRule : undefined}
                className={`rounded-xl border bg-white p-4 transition-shadow ${
                  rule.id === addedRuleId
                    ? "border-vr-300 ring-2 ring-vr-100"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">
                    {t("settings.cancellation.ifWithin")}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    aria-label={`${t("settings.cancellation.removeTier")} ${index + 1}`}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      {t("settings.cancellation.hours")}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={rule.hoursBeforeDeparture}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "hoursBeforeDeparture",
                            event.target.value,
                          )
                        }
                        aria-label={`${t("settings.cancellation.hours")} ${index + 1}`}
                        className={inputClass}
                      />
                      <span className="shrink-0 text-sm text-gray-500">
                        {t("settings.cancellation.hoursUnit")}
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      {t("settings.cancellation.operatorKeeps")}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        value={rule.feePercent}
                        onChange={(event) =>
                          updateRule(rule.id, "feePercent", event.target.value)
                        }
                        aria-label={`${t("settings.cancellation.fee")} ${index + 1}`}
                        className={inputClass}
                      />
                      <span className="shrink-0 text-sm text-gray-500">%</span>
                    </div>
                  </label>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  {feePercent === null
                    ? t("settings.cancellation.previewPending")
                    : refundLabel(feePercent, t)}
                </p>
              </div>
            );
          })}
          {parsed.ok ? (
            <div className="rounded-xl bg-vr-50 px-4 py-3">
              <p className="text-xs font-semibold text-vr-800">
                {t("settings.cancellation.summaryTitle")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {windows.map((window) => (
                  <li
                    key={`${window.fromExclusive}-${window.toInclusive}-${window.feePercent}`}
                    className="text-sm leading-6 text-gray-700"
                  >
                    {windowTitle(window, t)}
                    {": "}
                    {refundLabel(window.feePercent, t)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
        <Button variant="secondary" onClick={handleReset} disabled={loading}>
          {t("settings.undo")}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={loading || !operator || isSaving}
        >
          {t("settings.cancellation.save")}
        </Button>
      </div>
    </div>
  );
}
