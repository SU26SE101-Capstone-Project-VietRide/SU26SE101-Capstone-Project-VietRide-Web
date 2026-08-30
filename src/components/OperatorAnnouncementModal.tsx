import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToastFeedback } from "../hooks/useToastFeedback";
import { FiHash, FiSend, FiType, FiUsers } from "react-icons/fi";
import {
  sendOperatorNotification,
  type OperatorNotificationScope,
} from "../api/vietride";
import CustomSelect from "./CustomSelect";
import { IconInput } from "./form/IconInput";
import { textareaClass } from "./form/formClasses";
import Modal from "./Modal";

type OperatorAnnouncementModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function OperatorAnnouncementModal({
  open,
  onClose,
}: OperatorAnnouncementModalProps) {
  const { t } = useTranslation("common");
  const [scope, setScope] = useState<OperatorNotificationScope>("OPERATOR");
  const [tripId, setTripId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useToastFeedback({ message: success, error });


  function handleClose() {
    if (submitting) return;
    setError("");
    setSuccess("");
    onClose();
  }
  async function handleSubmit() {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedTripId = tripId.trim();

    if (!normalizedTitle || !normalizedBody) {
      setError(t("announcementModal.validationRequired"));
      return;
    }
    if (scope === "TRIP" && !normalizedTripId) {
      setError(t("announcementModal.tripIdRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendOperatorNotification({
        scope,
        tripId: scope === "TRIP" ? normalizedTripId : undefined,
        title: normalizedTitle,
        body: normalizedBody,
      });
      setSuccess(
        t("announcementModal.accepted", { count: result.recipientCount }),
      );
      setTitle("");
      setBody("");
      setTripId("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("announcementModal.sendFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("announcementModal.title")}
      subtitle={t("announcementModal.subtitle")}
      icon={<FiSend />}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("close")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiSend />{" "}
            {submitting
              ? t("announcementModal.submitting")
              : t("announcementModal.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t("announcementModal.scope")}</span>
          <CustomSelect
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as OperatorNotificationScope)
            }
            aria-label={t("announcementModal.scopeAria")}
            icon={<FiUsers size={18} />}
          >
            <option value="OPERATOR">{t("announcementModal.scopeOperator")}</option>
            <option value="TRIP">{t("announcementModal.scopeTrip")}</option>
          </CustomSelect>
        </label>

        {scope === "TRIP" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{t("announcementModal.tripId")}</span>
            <IconInput
              icon={<FiHash size={18} />}
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              placeholder={t("announcementModal.tripIdPlaceholder")}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t("title")}</span>
          <IconInput
            icon={<FiType size={18} />}
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("announcementModal.titlePlaceholder")}
          />
          <span className="mt-1 block text-right text-xs text-gray-600">{title.length}/120</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t("content")}</span>
          <textarea
            value={body}
            maxLength={500}
            onChange={(event) => setBody(event.target.value)}
            className={`${textareaClass} min-h-28 resize-y`}
            placeholder={t("announcementModal.bodyPlaceholder")}
          />
          <span className="mt-1 block text-right text-xs text-gray-600">{body.length}/500</span>
        </label>

      </div>
    </Modal>
  );
}

