import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiExternalLink, FiFileText, FiImage } from "react-icons/fi";
import type { ParcelClaimEvidence } from "../../../api/vietride";
import { Badge } from "../../../components/ui/Badge";
import { formatDateTime } from "../../../utils/date";

type ClaimEvidenceCardProps = {
  evidence: ParcelClaimEvidence;
  accepted?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelectedChange?: (selected: boolean) => void;
};

function isHttpUrl(reference: string) {
  return /^https?:\/\//i.test(reference);
}

function isLikelyImage(reference: string, evidenceType: string) {
  if (!isHttpUrl(reference)) return false;
  if (/(IMAGE|PHOTO)/i.test(evidenceType)) return true;
  try {
    const pathname = decodeURIComponent(new URL(reference).pathname);
    return /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(pathname);
  } catch {
    return false;
  }
}

export default function ClaimEvidenceCard({
  evidence,
  accepted = false,
  selected,
  disabled = false,
  onSelectedChange,
}: ClaimEvidenceCardProps) {
  const { t } = useTranslation("manager");
  const [imageFailed, setImageFailed] = useState(false);
  const selectable = typeof onSelectedChange === "function";
  const referenceIsUrl = isHttpUrl(evidence.reference);
  const showImage =
    isLikelyImage(evidence.reference, evidence.evidenceType) && !imageFailed;
  const checkboxId = `claim-evidence-${evidence.evidenceId}`;

  return (
    <article
      className={
        "overflow-hidden rounded-xl border bg-white " +
        (selected ? "border-vr-300 ring-1 ring-vr-100" : "border-gray-200")
      }
    >
      {showImage ? (
        <a
          href={evidence.reference}
          target="_blank"
          rel="noreferrer noopener"
          className="block bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vr-500"
          aria-label={t("claims.openEvidence")}
        >
          <img
            src={evidence.reference}
            alt={t("claims.evidenceImageAlt", {
              type: t(`claims.evidenceType.${evidence.evidenceType}`, {
                defaultValue: t("claims.evidenceType.OTHER"),
              }),
            })}
            width={640}
            height={360}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-36 w-full object-cover"
          />
        </a>
      ) : null}

      <div className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {t(`claims.evidenceType.${evidence.evidenceType}`, {
                defaultValue: t("claims.evidenceType.OTHER"),
              })}
            </Badge>
            {accepted ? (
              <Badge tone="success">{t("claims.evidenceAccepted")}</Badge>
            ) : null}
          </div>
          <span className="text-xs text-gray-500">
            {formatDateTime(evidence.createdAt)}
          </span>
        </div>

        {evidence.note?.trim() ? (
          <p className="mt-2 text-sm text-gray-700">{evidence.note}</p>
        ) : null}

        {referenceIsUrl ? (
          !showImage ? (
            <a
              href={evidence.reference}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-vr-900 hover:bg-gray-100"
            >
              {imageFailed ? (
                <FiImage className="shrink-0" aria-hidden="true" />
              ) : (
                <FiExternalLink className="shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {imageFailed
                  ? t("claims.imagePreviewFailed")
                  : t("claims.openDocument")}
              </span>
            </a>
          ) : (
            <a
              href={evidence.reference}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-vr-800 underline"
            >
              <FiExternalLink aria-hidden="true" />
              {t("claims.openEvidence")}
            </a>
          )
        ) : (
          <p className="mt-3 flex items-start gap-2 break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <FiFileText className="mt-0.5 shrink-0" aria-hidden="true" />
            {evidence.reference}
          </p>
        )}

        {selectable ? (
          <label
            htmlFor={checkboxId}
            className="mt-3 flex cursor-pointer items-start gap-2 border-t border-gray-100 pt-3 text-sm font-semibold text-gray-800"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={selected === true}
              disabled={disabled}
              onChange={(event) => onSelectedChange(event.target.checked)}
              className="mt-0.5"
            />
            <span>{t("claims.acceptThisEvidence")}</span>
          </label>
        ) : null}
      </div>
    </article>
  );
}
