// Chi tiết kiện chưa định danh + danh sách Parcel ứng viên để ghép (§10.2–10.5).
//
// Candidate chỉ được tải khi BE cho phép xem (`VIEW_MATCH_CANDIDATES`); package
// đã ghép rồi thì endpoint trả mảng rỗng nên gọi cũng vô nghĩa.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiHelpCircle, FiPackage } from "react-icons/fi";
import {
  getUnidentifiedPackageMatchCandidates,
  matchUnidentifiedPackage,
  type UnidentifiedPackage,
  type UnidentifiedPackageMatchCandidate,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { formatDateTime } from "../../../utils/date";
import { locationLabel } from "../../../utils/parcelReliability";
import {
  hasPackageAction,
  packageStatusTone,
  unidentifiedErrorTranslationKey,
} from "./unidentifiedHelpers";

type PackageDetailModalProps = {
  open: boolean;
  packageItem: UnidentifiedPackage | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onPackageChange: (next: UnidentifiedPackage) => void;
  onMessage: (message: string) => void;
};

const CANDIDATE_LIMIT = 20;

export default function PackageDetailModal({
  open,
  packageItem,
  isLoading,
  error,
  onClose,
  onPackageChange,
  onMessage,
}: PackageDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [candidates, setCandidates] = useState<
    UnidentifiedPackageMatchCandidate[]
  >([]);
  const [candidateState, setCandidateState] = useState<{
    packageId: string;
    isLoading: boolean;
    error: string;
  }>({ packageId: "", isLoading: false, error: "" });
  const [pendingMatch, setPendingMatch] =
    useState<UnidentifiedPackageMatchCandidate | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  // Mở nhanh hai kiện liên tiếp: lượt nạp candidate về sau không ghi đè kiện
  // đang mở.
  const candidateRequestRef = useRef("");

  const packageId = packageItem?.packageId ?? "";
  const canMatch = hasPackageAction(packageItem?.availableActions, "MATCH");
  const canViewCandidates = hasPackageAction(
    packageItem?.availableActions,
    "VIEW_MATCH_CANDIDATES",
  );

  const loadCandidates = useCallback(async (id: string) => {
    candidateRequestRef.current = id;
    setCandidateState({ packageId: id, isLoading: true, error: "" });
    try {
      const result = await getUnidentifiedPackageMatchCandidates(id, {
        limit: CANDIDATE_LIMIT,
      });
      if (candidateRequestRef.current !== id) return;
      setCandidates(result);
      setCandidateState({ packageId: id, isLoading: false, error: "" });
    } catch (err) {
      if (candidateRequestRef.current !== id) return;
      setCandidates([]);
      setCandidateState({
        packageId: id,
        isLoading: false,
        error: t(
          unidentifiedErrorTranslationKey(
            err,
            "unidentifiedPackages.candidatesLoadFailed",
          ),
        ),
      });
    }
  }, [t]);

  useEffect(() => {
    if (!open || !packageId || !canViewCandidates) {
      return;
    }
    if (candidateState.packageId === packageId) {
      return;
    }
    void loadCandidates(packageId);
  }, [
    canViewCandidates,
    candidateState.packageId,
    loadCandidates,
    open,
    packageId,
  ]);

  async function confirmMatch() {
    if (!packageItem || !pendingMatch || isMatching) return;

    setIsMatching(true);
    try {
      const next = await matchUnidentifiedPackage(packageItem.packageId, {
        parcelId: pendingMatch.parcelId,
      });
      setPendingMatch(null);
      setCandidates([]);
      setCandidateState({ packageId: "", isLoading: false, error: "" });
      onPackageChange(next);
      onMessage(
        t("unidentifiedPackages.matchSuccess", {
          code: pendingMatch.parcelCode,
        }),
      );
    } catch (err) {
      setCandidateState((prev) => ({
        ...prev,
        error:
          t(
            unidentifiedErrorTranslationKey(
              err,
              "unidentifiedPackages.matchFailed",
            ),
          ),
      }));
      setPendingMatch(null);
    } finally {
      setIsMatching(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        icon={<FiHelpCircle size={20} />}
        title={t("unidentifiedPackages.detailTitle")}
        subtitle={packageItem?.temporaryExceptionTag}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {tc("close")}
            </Button>
          </div>
        }
      >
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : isLoading || !packageItem ? (
          <p className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-gray-900">
                    {packageItem.temporaryExceptionTag}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {packageItem.description?.trim() ||
                      t("unidentifiedPackages.noDescription")}
                  </p>
                </div>
                <Badge tone={packageStatusTone(packageItem.status)}>
                  {t(`unidentifiedPackages.status.${packageItem.status}`, {
                    defaultValue: t("unidentifiedPackages.unknownStatus"),
                  })}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                <DetailItem
                  label={t("unidentifiedPackages.locationColumn")}
                  value={
                    packageItem.locationSnapshot?.trim() ||
                    t(
                      `parcelIncidents.locationTypes.${packageItem.locationType}`,
                      {
                        defaultValue: t(
                          "unidentifiedPackages.unknownLocation",
                        ),
                      },
                    )
                  }
                />
                <DetailItem
                  label={t("unidentifiedPackages.weightLabel")}
                  value={
                    packageItem.observedWeightKg == null
                      ? "-"
                      : `${packageItem.observedWeightKg} kg`
                  }
                />
                <DetailItem
                  label={t("unidentifiedPackages.createdAtColumn")}
                  value={formatDateTime(packageItem.createdAt)}
                />
              </dl>

              {packageItem.matchedParcel && (
                <p className="mt-3 text-sm text-gray-700">
                  {t("unidentifiedPackages.matchedWith", {
                    code: packageItem.matchedParcel.parcelCode,
                    at: packageItem.matchedAt
                      ? formatDateTime(packageItem.matchedAt)
                      : "-",
                  })}
                </p>
              )}

              {(packageItem.evidenceReferences ?? []).length > 0 && (
                <ul className="mt-3 space-y-1">
                  {(packageItem.evidenceReferences ?? []).map((reference, index) => (
                    <li key={reference} className="break-all text-sm">
                      {/* Tham chiếu do nhân viên nhập, không chắc là URL */}
                      {/^https?:\/\//i.test(reference) ? (
                        <a
                          href={reference}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-medium text-vr-900 underline"
                        >
                          {t("unidentifiedPackages.viewEvidence", {
                            index: index + 1,
                          })}
                        </a>
                      ) : (
                        <span className="text-gray-700">
                          {t("unidentifiedPackages.evidenceUnavailable")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiPackage className="text-vr-900" aria-hidden="true" />
                {t("unidentifiedPackages.candidatesTitle")}
              </h3>

              {candidateState.error ? (
                <div className="mt-2">
                  <InlineAlert tone="error">
                    <p>{candidateState.error}</p>
                  </InlineAlert>
                </div>
              ) : null}

              {!canViewCandidates ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("unidentifiedPackages.candidatesUnavailable")}
                </p>
              ) : candidateState.isLoading ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {tc("loading")}
                </p>
              ) : candidates.length === 0 ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("unidentifiedPackages.candidatesEmpty")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {candidates.map((candidate) => (
                    <li
                      key={candidate.parcelId}
                      className="rounded-lg border border-gray-200 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {candidate.parcelCode}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600">
                            {candidate.description?.trim() ||
                              t("unidentifiedPackages.noDescription")}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {t("unidentifiedPackages.candidateMeta", {
                              weight: candidate.weightKg,
                              route:
                                candidate.trip?.route?.name ||
                                t("unidentifiedPackages.unknownRoute"),
                              dropoff: locationLabel(
                                candidate.expectedDropoff,
                                t("unidentifiedPackages.unknownLocation"),
                                (type) =>
                                  t(`parcelIncidents.locationTypes.${type}`, {
                                    defaultValue: t(
                                      "unidentifiedPackages.unknownLocation",
                                    ),
                                  }),
                              ),
                            })}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {candidate.matchReasons.map((reason) => (
                              <Badge key={reason} tone="info">
                                {t(
                                  `unidentifiedPackages.matchReasons.${reason}`,
                                  {
                                    defaultValue: t(
                                      "unidentifiedPackages.unknownMatchReason",
                                    ),
                                  },
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {/* Ghép lại kiện đã ghép làm BE trả 500 — nút chỉ hiện
                            khi `availableActions` còn cho phép. */}
                        {canMatch && (
                          <Button
                            variant="primary"
                            onClick={() => setPendingMatch(candidate)}
                            disabled={isMatching}
                          >
                            {t("unidentifiedPackages.matchAction")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={pendingMatch !== null}
        title={t("unidentifiedPackages.matchConfirmTitle")}
        message={t("unidentifiedPackages.matchConfirmMessage", {
          tag: packageItem?.temporaryExceptionTag ?? "",
          code: pendingMatch?.parcelCode ?? "",
        })}
        confirmLabel={t("unidentifiedPackages.matchAction")}
        cancelLabel={tc("cancel")}
        tone="success"
        busy={isMatching}
        onConfirm={() => void confirmMatch()}
        onClose={() => setPendingMatch(null)}
      />
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}
