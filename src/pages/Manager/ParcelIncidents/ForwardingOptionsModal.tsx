// Chọn chuyến chở tiếp cho kiện đã tìm thấy (§6.6, §6.7).
//
// Trip Service là nơi tính tuyến và sức chứa — màn này KHÔNG tự suy luận chuyến
// nào chở được. Option `canReserve=false` vẫn hiện nhưng khoá lại kèm lý do BE
// trả về, để điều độ viên biết vì sao không chọn được thay vì thấy danh sách
// ngắn đi một cách khó hiểu.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiNavigation, FiRefreshCw } from "react-icons/fi";
import {
  forwardOperatorParcelIncident,
  getOperatorParcelIncidentForwardingOptions,
  type ParcelForwardingOption,
  type ParcelIncidentDetail,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../utils/date";
import { locationLabel } from "../../../utils/parcelReliability";

type ForwardingOptionsModalProps = {
  open: boolean;
  incidentId: string;
  onClose: () => void;
  onDone: (detail: ParcelIncidentDetail, successMessage: string) => void;
};

const OPTION_LIMIT = 20;

export default function ForwardingOptionsModal({
  open,
  incidentId,
  onClose,
  onDone,
}: ForwardingOptionsModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [options, setOptions] = useState<ParcelForwardingOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittingTripId, setSubmittingTripId] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Nạp đúng một lần mỗi lần mở (§11.1 mục 6) — và thêm một lần nữa khi người
  // dùng chủ động bấm làm mới.
  useEffect(() => {
    if (!open) return;

    let ignore = false;

    async function loadOptions() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getOperatorParcelIncidentForwardingOptions(
          incidentId,
          { limit: OPTION_LIMIT },
        );
        if (!ignore) setOptions(result);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : tRef.current("parcelIncidents.forwardingOptionsFailed"),
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void loadOptions();
    return () => {
      ignore = true;
    };
  }, [incidentId, open, reloadVersion]);

  async function forward(tripId: string) {
    if (submittingTripId) return;

    setSubmittingTripId(tripId);
    setError("");

    try {
      const detail = await forwardOperatorParcelIncident(incidentId, {
        targetTripId: tripId,
      });
      onDone(detail, t("parcelIncidents.forwardSuccess"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("parcelIncidents.actionFailed"),
      );
    } finally {
      setSubmittingTripId("");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiNavigation size={20} />}
      title={t("parcelIncidents.forwardingTitle")}
      subtitle={t("parcelIncidents.forwardingSubtitle")}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="secondary"
            leadingIcon={<FiRefreshCw size={15} />}
            onClick={() => setReloadVersion((current) => current + 1)}
            disabled={isLoading || Boolean(submittingTripId)}
          >
            {tc("refresh")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {isLoading && (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        )}

        {!isLoading && options.length === 0 && !error && (
          <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            {t("parcelIncidents.forwardingEmpty")}
          </p>
        )}

        {options.map((option) => {
          const tripId = option.trip?.tripId ?? "";
          const routeName =
            option.route?.name ||
            option.trip?.route?.name ||
            t("parcelIncidents.unknownRoute");
          const plate =
            option.vehicle?.licensePlate ||
            option.trip?.vehicle?.licensePlate ||
            t("parcelIncidents.unknownVehicle");

          return (
            <article
              key={tripId || routeName}
              className={`rounded-xl border p-4 ${
                option.canReserve
                  ? "border-gray-200 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{routeName}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{plate}</p>
                </div>
                {option.canReserve ? (
                  <Badge tone="success">
                    {t("parcelIncidents.optionAvailable")}
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    {t("parcelIncidents.optionUnavailable")}
                  </Badge>
                )}
              </div>

              <dl className="mt-3 grid gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">
                    {t("parcelIncidents.pickupLocation")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-gray-800">
                    {locationLabel(
                      option.pickupLocation,
                      t("parcelIncidents.unknownLocation"),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">
                    {t("parcelIncidents.targetDropoff")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-gray-800">
                    {locationLabel(
                      option.targetDropoff,
                      t("parcelIncidents.unknownLocation"),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">
                    {t("parcelIncidents.departureAt")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-gray-800">
                    {option.departureAt ? formatDateTime(option.departureAt) : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t("parcelIncidents.eta")}</dt>
                  <dd className="mt-0.5 font-semibold text-gray-800">
                    {option.eta ? formatDateTime(option.eta) : "-"}
                  </dd>
                </div>
              </dl>

              {/* Lý do không chọn được đến từ BE — hiện nguyên văn, đừng đoán */}
              {!option.canReserve && option.unavailableReason && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {t(
                    `parcelIncidents.unavailableReasons.${option.unavailableReason}`,
                    { defaultValue: option.unavailableReason },
                  )}
                </p>
              )}

              <div className="mt-3 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    !option.canReserve ||
                    !tripId ||
                    Boolean(submittingTripId)
                  }
                  onClick={() => void forward(tripId)}
                >
                  {submittingTripId === tripId
                    ? tc("processing")
                    : t("parcelIncidents.chooseTrip")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
