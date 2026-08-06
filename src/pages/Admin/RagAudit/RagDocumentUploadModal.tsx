import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiUploadCloud } from "react-icons/fi";
import {
  uploadRagDocument,
  type RagDocument,
  type RagDocumentAccessLevel,
  type RagDocumentCategory,
  type RagDocumentType,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: (document: RagDocument) => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500";

export function RagDocumentUploadModal({
  open,
  onClose,
  onUploaded,
}: Props) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] =
    useState<RagDocumentAccessLevel>("ADMIN");
  const [category, setCategory] =
    useState<RagDocumentCategory>("PLATFORM_ADMIN");
  const [documentType, setDocumentType] =
    useState<RagDocumentType>("GUIDE");
  const [audienceRoles, setAudienceRoles] = useState("SYSTEM_ADMIN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) {
      setError(t("ragAudit.uploadRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const uploaded = await uploadRagDocument({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        accessLevel,
        category,
        documentType,
        audienceRoles: audienceRoles
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean),
        language: "vi",
      });
      onUploaded(uploaded);
      setFile(null);
      setTitle("");
      setDescription("");
      onClose();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("ragAudit.actionFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  useToastFeedback({ error });
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiUploadCloud />}
      title={t("ragAudit.uploadModalTitle")}
      subtitle={t("ragAudit.uploadHint")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium"
          >
            {tc("cancel")}
          </button>
          <button
            type="submit"
            form="rag-upload-form"
            disabled={submitting}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? tc("processing") : tc("upload")}
          </button>
        </>
      }
    >
      <form
        id="rag-upload-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => void submit(event)}
      >
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {tc("file")}
          </span>
          <input
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={inputClass}
            required
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {tc("title")}
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {tc("description")}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${inputClass} min-h-20`}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Access level
          </span>
          <CustomSelect
            value={accessLevel}
            onChange={(event) => setAccessLevel(event.target.value)}
            className={inputClass}
          >
            <option value="PUBLIC">{tc("enumLabels.PUBLIC")}</option>
            <option value="OPERATOR">{tc("enumLabels.OPERATOR")}</option>
            <option value="ADMIN">{tc("enumLabels.ADMIN")}</option>
          </CustomSelect>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Category
          </span>
          <CustomSelect
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass}
          >
            <option value="CUSTOMER_SUPPORT">
              {t("ragAudit.categories.CUSTOMER_SUPPORT")}
            </option>
            <option value="OPERATOR_POLICY">
              {t("ragAudit.categories.OPERATOR_POLICY")}
            </option>
            <option value="PLATFORM_ADMIN">
              {t("ragAudit.categories.PLATFORM_ADMIN")}
            </option>
          </CustomSelect>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Document type
          </span>
          <CustomSelect
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={inputClass}
          >
            <option value="FAQ">{t("ragAudit.documentTypes.FAQ")}</option>
            <option value="POLICY">{t("ragAudit.documentTypes.POLICY")}</option>
            <option value="SOP">{t("ragAudit.documentTypes.SOP")}</option>
            <option value="GUIDE">{t("ragAudit.documentTypes.GUIDE")}</option>
            <option value="TERMS">{t("ragAudit.documentTypes.TERMS")}</option>
          </CustomSelect>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Audience roles
          </span>
          <input
            value={audienceRoles}
            onChange={(event) => setAudienceRoles(event.target.value)}
            className={inputClass}
            placeholder="SYSTEM_ADMIN, OPERATOR_ADMIN"
          />
        </label>
      </form>
    </Modal>
  );
}
