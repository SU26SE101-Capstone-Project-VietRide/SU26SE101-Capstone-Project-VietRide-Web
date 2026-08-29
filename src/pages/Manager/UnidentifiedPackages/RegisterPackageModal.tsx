// Đăng ký một kiện hàng chưa định danh tại bến (§10.4).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiHelpCircle } from "react-icons/fi";
import {
  PARCEL_CUSTODY_LOCATION_TYPES,
  registerUnidentifiedPackage,
  type UnidentifiedPackage,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import EvidenceUploader from "../../../components/EvidenceUploader";
import {
  parseRegisterPackageDraft,
  type RegisterPackageDraft,
} from "./unidentifiedHelpers";

type RegisterPackageModalProps = {
  open: boolean;
  onClose: () => void;
  onRegistered: (created: UnidentifiedPackage, message: string) => void;
};

const emptyDraft: RegisterPackageDraft = {
  temporaryExceptionTag: "",
  tripId: "",
  locationType: "WAREHOUSE",
  locationId: "",
  locationSnapshot: "",
  description: "",
  observedWeightKg: "",
  evidenceReferences: [],
};

export default function RegisterPackageModal({
  open,
  onClose,
  onRegistered,
}: RegisterPackageModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [draft, setDraft] = useState<RegisterPackageDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof RegisterPackageDraft>(
    key: K,
    value: RegisterPackageDraft[K],
  ) {
    setError("");
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setDraft(emptyDraft);
    setError("");
    onClose();
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const parsed = parseRegisterPackageDraft(draft);
    if (!parsed.ok) {
      setError(t(`unidentifiedPackages.registerErrors.${parsed.error}`));
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const created = await registerUnidentifiedPackage(parsed.value);
      setDraft(emptyDraft);
      onRegistered(created, t("unidentifiedPackages.registerSuccess"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("unidentifiedPackages.registerFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      icon={<FiHelpCircle size={20} />}
      title={t("unidentifiedPackages.registerTitle")}
      subtitle={t("unidentifiedPackages.registerSubtitle")}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {t("unidentifiedPackages.registerSubmit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <InlineAlert tone="error">
            <p>{error}</p>
          </InlineAlert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="package-tag">
              {t("unidentifiedPackages.tagLabel")}
              <span className="text-rose-700"> *</span>
            </label>
            <input
              id="package-tag"
              type="text"
              value={draft.temporaryExceptionTag}
              onChange={(event) =>
                update("temporaryExceptionTag", event.target.value)
              }
              placeholder={t("unidentifiedPackages.tagPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="package-trip">
              {t("unidentifiedPackages.tripIdLabel")}
            </label>
            <input
              id="package-trip"
              type="text"
              value={draft.tripId}
              onChange={(event) => update("tripId", event.target.value)}
              placeholder={t("unidentifiedPackages.optionalPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {t("unidentifiedPackages.locationTypeLabel")}
              <span className="text-rose-700"> *</span>
            </label>
            <CustomSelect
              aria-label={t("unidentifiedPackages.locationTypeLabel")}
              className={inputClass}
              value={draft.locationType}
              onChange={(event) => update("locationType", event.target.value)}
            >
              {PARCEL_CUSTODY_LOCATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`parcelIncidents.locationTypes.${value}`, {
                    defaultValue: value,
                  })}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <label className={labelClass} htmlFor="package-location-id">
              {t("unidentifiedPackages.locationIdLabel")}
              <span className="text-rose-700"> *</span>
            </label>
            <input
              id="package-location-id"
              type="text"
              value={draft.locationId}
              onChange={(event) => update("locationId", event.target.value)}
              className={inputClass}
            />
            {/* Khác custody scan: entity này đòi mã địa điểm kể cả VEHICLE */}
            <p className="mt-1 text-xs text-gray-600">
              {t("unidentifiedPackages.locationIdHint")}
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="package-location-snapshot">
              {t("unidentifiedPackages.locationSnapshotLabel")}
            </label>
            <input
              id="package-location-snapshot"
              type="text"
              value={draft.locationSnapshot}
              onChange={(event) =>
                update("locationSnapshot", event.target.value)
              }
              placeholder={t("unidentifiedPackages.optionalPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="package-weight">
              {t("unidentifiedPackages.weightLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="package-weight"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={draft.observedWeightKg}
                onChange={(event) =>
                  update("observedWeightKg", event.target.value)
                }
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-gray-500">kg</span>
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="package-description">
            {t("unidentifiedPackages.descriptionLabel")}
            <span className="text-rose-700"> *</span>
          </label>
          <textarea
            id="package-description"
            rows={2}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder={t("unidentifiedPackages.descriptionPlaceholder")}
            className={textareaClass}
          />
        </div>

        <EvidenceUploader
          purpose="PARCEL_EVIDENCE_PHOTO"
          required
          value={draft.evidenceReferences}
          onChange={(next) => update("evidenceReferences", next)}
          label={t("unidentifiedPackages.evidenceLabel")}
          hint={t("unidentifiedPackages.evidenceHint")}
        />
      </div>
    </Modal>
  );
}
