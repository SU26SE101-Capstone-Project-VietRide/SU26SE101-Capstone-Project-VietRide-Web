// Ô đính ảnh chứng cứ dùng chung cho các luồng hàng hoá: bàn giao tại bến,
// đăng ký kiện chưa định danh, thao tác sự cố.
//
// Trước đây ba chỗ này đều bắt dán link ảnh, mỗi dòng một link — nhân viên đứng
// ở bến cầm điện thoại vừa chụp thì không có link nào để dán. Giờ chọn file từ
// máy, component tự đẩy lên Firebase rồi trả về đúng mảng URL mà BE cần.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPaperclip, FiTrash2 } from "react-icons/fi";
import type { FirebaseUploadPurpose } from "../api/vietride";
import {
  FirebaseImageError,
  uploadFirebaseImages,
} from "../utils/firebaseImageUpload";
import { Button } from "./ui/Button";
import { labelClass } from "./form/formClasses";

type EvidenceUploaderProps = {
  /** `PARCEL_PHOTO` cho kiện hàng, `INCIDENT_PHOTO` cho sự cố. */
  purpose: FirebaseUploadPurpose;
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  hint?: string;
  required?: boolean;
  /** Chặn trước khi tải lên cho khỏi phí băng thông. */
  max?: number;
  disabled?: boolean;
};

const DEFAULT_MAX = 5;

function uploadErrorKey(error: unknown) {
  if (error instanceof FirebaseImageError) {
    if (error.code === "INVALID_TYPE") return "evidenceUpload.invalidType";
    if (error.code === "INVALID_SIZE") return "evidenceUpload.invalidSize";
  }
  return "evidenceUpload.failed";
}

export default function EvidenceUploader({
  purpose,
  value,
  onChange,
  label,
  hint,
  required,
  max = DEFAULT_MAX,
  disabled,
}: EvidenceUploaderProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const isFull = value.length >= max;

  async function handleFiles(fileList: FileList | null) {
    const files = [...(fileList ?? [])];
    if (files.length === 0) return;

    setError("");
    if (value.length + files.length > max) {
      setError(t("evidenceUpload.tooMany", { max }));
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadFirebaseImages(purpose, files);
      onChange([...value, ...uploaded]);
    } catch (uploadError) {
      // Lỗi định dạng/dung lượng thì FE tự diễn giải được. Còn lại (hết quyền,
      // thiếu token, Storage rules chặn) là thông điệp của server — hiện nguyên
      // văn, đừng bảo người dùng "thử lại" khi thử lại không giúp được gì.
      setError(
        uploadError instanceof FirebaseImageError
          ? t(uploadErrorKey(uploadError))
          : uploadError instanceof Error
            ? uploadError.message
            : t("evidenceUpload.failed"),
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="block">
      <span className={labelClass}>
        {label}
        {required && <span className="text-rose-700"> *</span>}
      </span>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((url, index) => (
            <li key={url} className="relative">
              <img
                src={url}
                alt={t("evidenceUpload.photoIndex", { index: index + 1 })}
                className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
              />
              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => onChange(value.filter((item) => item !== url))}
                aria-label={`${t("evidenceUpload.remove")} ${index + 1}`}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-gray-200 bg-white p-1 text-gray-600 shadow-sm hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        data-testid="evidence-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(event) => {
          void handleFiles(event.target.files);
          // Cho phép chọn lại đúng file vừa xoá
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          leadingIcon={<FiPaperclip size={14} />}
          disabled={disabled || isUploading || isFull}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? t("evidenceUpload.uploading") : t("evidenceUpload.add")}
        </Button>
        <span className="text-xs text-gray-600">
          {value.length > 0
            ? t("evidenceUpload.count", { count: value.length, max })
            : t("evidenceUpload.empty")}
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-gray-600">{hint}</p> : null}
    </div>
  );
}
