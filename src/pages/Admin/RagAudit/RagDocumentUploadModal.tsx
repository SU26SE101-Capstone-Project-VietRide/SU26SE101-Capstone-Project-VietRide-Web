import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiFileText, FiUploadCloud, FiX } from "react-icons/fi";
import {
  uploadRagDocument,
  type RagDocument,
  type RagDocumentAccessLevel,
  type RagDocumentCategory,
  type RagDocumentType,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Checkbox from "../../../components/form/Checkbox";
import Modal from "../../../components/Modal";

/**
 * Vai trò được phép đọc tài liệu. BE khớp mảng này với vai trò của NGƯỜI ĐANG HỎI
 * trợ lý (`chat.repository.ts` lọc `audience_roles @> ARRAY[callerRole]`), và
 * KHÔNG ràng buộc enum — gõ sai một ký tự là tài liệu vô hình với mọi người mà
 * vẫn lưu thành công. Vì vậy màn khoá cứng danh sách thay vì cho nhập tay.
 *
 * Giữ đủ 6 giá trị của `RagRole`, kể cả `OPERATOR_STAFF`: web console không còn
 * phục vụ vai trò đó nhưng BE vẫn cấp và người mang vai trò đó vẫn hỏi trợ lý
 * qua client khác, nên tài liệu vẫn cần nhắm tới được.
 */
const AUDIENCE_ROLES = [
  "PASSENGER",
  "DRIVER",
  "ASSISTANT",
  "OPERATOR_STAFF",
  "OPERATOR_ADMIN",
  "SYSTEM_ADMIN",
] as const;

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
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] =
    useState<RagDocumentAccessLevel>("ADMIN");
  const [category, setCategory] =
    useState<RagDocumentCategory>("PLATFORM_ADMIN");
  const [documentType, setDocumentType] =
    useState<RagDocumentType>("GUIDE");
  const [audienceRoles, setAudienceRoles] = useState<string[]>([
    "SYSTEM_ADMIN",
  ]);
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
        audienceRoles,
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
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="submit"
            form="rag-upload-form"
            disabled={submitting}
            className="rounded-xl bg-vr-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? tc("processing") : tc("upload")}
          </button>
        </>
      }
    >
      <form
        id="rag-upload-form"
        className="space-y-6"
        onSubmit={(event) => void submit(event)}
      >
        <section className="rounded-2xl border border-vr-100 bg-vr-50/60 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900">{t("ragAudit.fileSection")}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">{t("ragAudit.fileSectionHint")}</p>
          </div>
          <label
            htmlFor="rag-document-file"
            onDragOver={(event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setIsDragging(false); setFile(event.dataTransfer.files[0] ?? null); }}
            className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-5 py-6 text-center transition ${isDragging ? "border-vr-500 bg-vr-50" : "border-gray-200 hover:border-vr-300 hover:bg-vr-50/40"}`}
          >
            <input id="rag-document-file" type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" required />
            {file ? (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-vr-100 text-vr-900"><FiFileText size={22} /></span>
                <span className="text-left"><span className="block max-w-xs truncate text-sm font-semibold text-gray-900">{file.name}</span><span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span></span>
                <button type="button" onClick={(event) => { event.preventDefault(); setFile(null); }} className="rounded-full p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={t("ragAudit.removeFile")}><FiX /></button>
              </div>
            ) : (
              <><FiUploadCloud className="text-vr-500" size={30} /><span className="mt-2 text-sm font-semibold text-gray-700">{t("ragAudit.filePickerLabel")}</span><span className="mt-1 text-xs text-gray-500">{t("ragAudit.filePickerFormats")}</span></>
            )}
          </label>
        </section>

        <section className="space-y-4">
          <div><h3 className="text-sm font-bold text-gray-900">{t("ragAudit.infoSection")}</h3><p className="mt-1 text-xs text-gray-500">{t("ragAudit.infoSectionHint")}</p></div>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{tc("title")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} rounded-xl transition focus:ring-4 focus:ring-vr-500/10`} required /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{tc("description")}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} min-h-24 resize-y rounded-xl transition focus:ring-4 focus:ring-vr-500/10`} /></label>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
          <div><h3 className="text-sm font-bold text-gray-900">{t("ragAudit.accessSection")}</h3><p className="mt-1 text-xs text-gray-500">{t("ragAudit.accessSectionHint")}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("ragAudit.accessLevel")}</span><CustomSelect value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as RagDocumentAccessLevel)} className={`${inputClass} rounded-xl`}><option value="PUBLIC">{tc("enumLabels.PUBLIC")}</option><option value="OPERATOR">{tc("enumLabels.OPERATOR")}</option><option value="ADMIN">{tc("enumLabels.ADMIN")}</option></CustomSelect></label>
            <label><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("ragAudit.category")}</span><CustomSelect value={category} onChange={(event) => setCategory(event.target.value as RagDocumentCategory)} className={`${inputClass} rounded-xl`}><option value="CUSTOMER_SUPPORT">{t("ragAudit.categories.CUSTOMER_SUPPORT")}</option><option value="OPERATOR_POLICY">{t("ragAudit.categories.OPERATOR_POLICY")}</option><option value="PLATFORM_ADMIN">{t("ragAudit.categories.PLATFORM_ADMIN")}</option></CustomSelect></label>
            <label><span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("ragAudit.documentType")}</span><CustomSelect value={documentType} onChange={(event) => setDocumentType(event.target.value as RagDocumentType)} className={`${inputClass} rounded-xl`}><option value="FAQ">{t("ragAudit.documentTypes.FAQ")}</option><option value="POLICY">{t("ragAudit.documentTypes.POLICY")}</option><option value="SOP">{t("ragAudit.documentTypes.SOP")}</option><option value="GUIDE">{t("ragAudit.documentTypes.GUIDE")}</option><option value="TERMS">{t("ragAudit.documentTypes.TERMS")}</option></CustomSelect></label>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 block text-xs font-semibold text-gray-600">
                {t("ragAudit.audienceRoles")}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AUDIENCE_ROLES.map((role) => (
                  <Checkbox
                    key={role}
                    size="sm"
                    checked={audienceRoles.includes(role)}
                    onChange={(checked) =>
                      setAudienceRoles((current) =>
                        checked
                          ? [...current, role]
                          : current.filter((item) => item !== role),
                      )
                    }
                    label={tc(`roles.${role}`)}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                {audienceRoles.length === 0
                  ? t("ragAudit.audienceRolesEmpty")
                  : t("ragAudit.audienceRolesHint")}
              </p>
            </fieldset>
          </div>
        </section>
      </form>
    </Modal>
  );
}
