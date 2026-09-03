import { useTranslation } from "react-i18next";
import type { ParcelClaimAwardPreview } from "../../../api/vietride";
import InlineAlert from "../../../components/InlineAlert";
import { formatCurrency } from "../../../utils/currency";

type AwardPreviewPanelProps = {
  preview: ParcelClaimAwardPreview | null;
  isLoading: boolean;
  error: string;
};

export default function AwardPreviewPanel({
  preview,
  isLoading,
  error,
}: AwardPreviewPanelProps) {
  const { t } = useTranslation("manager");

  if (isLoading) {
    return (
      <div className="rounded-xl border border-vr-100 bg-vr-50 px-4 py-4 text-sm text-vr-900">
        {t("claims.previewLoading")}
      </div>
    );
  }
  if (error) {
    return (
      <InlineAlert tone="error">
        <p>{error}</p>
      </InlineAlert>
    );
  }
  if (!preview) return null;

  return (
    <section className="rounded-xl border border-vr-100 bg-vr-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-vr-900">
          {t("claims.previewTitle")}
        </h3>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-vr-800">
          {t("claims.calculationBasis." + preview.calculationBasis)}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {preview.assessedLossVnd != null ? (
          <PreviewItem
            label={t("claims.previewAssessedLoss")}
            value={formatCurrency(preview.assessedLossVnd)}
          />
        ) : null}
        {preview.declaredLiabilityVnd != null ? (
          <PreviewItem
            label={t("claims.previewDeclaredLiability")}
            value={formatCurrency(preview.declaredLiabilityVnd)}
          />
        ) : null}
        {preview.fallbackAmountVnd != null ? (
          <PreviewItem
            label={t("claims.previewFallback")}
            value={formatCurrency(preview.fallbackAmountVnd)}
          />
        ) : null}
        <PreviewItem
          label={t("claims.snapshotCap")}
          value={formatCurrency(preview.policySnapshot.maxCompensationVnd)}
        />
        <PreviewItem
          label={t("claims.cargoAward")}
          value={formatCurrency(preview.cargoAwardVnd)}
        />
        <PreviewItem
          label={t("claims.freightRefund")}
          value={formatCurrency(preview.freightRefundVnd)}
        />
      </dl>

      <div className="mt-3 rounded-lg bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("claims.totalAward")}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-vr-900">
          {formatCurrency(preview.totalAwardVnd)}
        </p>
      </div>

      {preview.originalTotalAwardVnd != null ? (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <PreviewItem
            label={t("claimAppeals.originalTotal")}
            value={formatCurrency(preview.originalTotalAwardVnd)}
          />
          <PreviewItem
            label={t("claimAppeals.supplementaryTitle")}
            value={formatCurrency(preview.supplementaryAwardVnd)}
            emphasized
          />
        </dl>
      ) : null}

      <p className="mt-3 text-xs text-gray-600">
        {t("claims.previewNotCommitment")}
      </p>
    </section>
  );
}

function PreviewItem({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={
          "mt-0.5 font-semibold tabular-nums " +
          (emphasized ? "text-vr-900" : "text-gray-900")
        }
      >
        {value}
      </dd>
    </div>
  );
}
