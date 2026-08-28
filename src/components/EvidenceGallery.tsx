// Khung xem bằng chứng CHỈ ĐỌC — bản đối của `EvidenceUploader`.
//
// Người duyệt báo cáo sự cố phải nhìn được ảnh chứ không phải một danh sách
// URL: quyết định duyệt/từ chối dựa hoàn toàn vào ảnh hiện trường. Ảnh nào tải
// hỏng thì rơi về link để vẫn mở được ở tab mới, và tham chiếu không phải URL
// (nhân viên gõ tay số hiệu chứng từ) hiện nguyên văn.
import { useState } from "react";
import { FiExternalLink, FiFileText } from "react-icons/fi";

type EvidenceGalleryProps = {
  references: string[];
  /** Nhãn cho từng ảnh, nhận số thứ tự bắt đầu từ 1. */
  photoLabel: (index: number) => string;
  emptyLabel: string;
  className?: string;
};

function isHttpUrl(reference: string) {
  return /^https?:\/\//i.test(reference);
}

export default function EvidenceGallery({
  references,
  photoLabel,
  emptyLabel,
  className = "",
}: EvidenceGalleryProps) {
  // Ảnh hỏng được nhớ theo URL: `onError` của <img> không lặp lại sau khi đã
  // đổi sang link nên không có vòng render vô hạn.
  const [brokenImages, setBrokenImages] = useState<string[]>([]);

  if (references.length === 0) {
    return <p className={`text-sm text-gray-500 ${className}`.trim()}>{emptyLabel}</p>;
  }

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {references.map((reference, index) => {
        const label = photoLabel(index + 1);

        if (!isHttpUrl(reference)) {
          return (
            <li
              key={reference}
              className="flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-700"
            >
              <FiFileText size={14} className="shrink-0" aria-hidden="true" />
              <span className="break-all">{reference}</span>
            </li>
          );
        }

        if (brokenImages.includes(reference)) {
          return (
            <li key={reference} className="max-w-full">
              <a
                href={reference}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-vr-900 underline"
              >
                <FiExternalLink size={14} className="shrink-0" aria-hidden="true" />
                <span className="break-all">{label}</span>
              </a>
            </li>
          );
        }

        return (
          <li key={reference}>
            <a
              href={reference}
              target="_blank"
              rel="noreferrer noopener"
              title={label}
              className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vr-500"
            >
              <img
                src={reference}
                alt={label}
                loading="lazy"
                onError={() =>
                  setBrokenImages((current) =>
                    current.includes(reference) ? current : [...current, reference],
                  )
                }
                className="h-24 w-24 rounded-lg border border-gray-200 object-cover transition hover:opacity-90"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
