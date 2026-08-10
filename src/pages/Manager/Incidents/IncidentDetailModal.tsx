// Chi tiết một sự cố. Chỉ đọc: BE chưa có API resolve nên màn không được dựng
// nút "Đã xử lý" — `status`/`resolvedAt`/`resolutionNote` là read model.
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiExternalLink, FiMapPin } from "react-icons/fi";
import { Link } from "react-router-dom";
import type { OperatorIncident } from "../../../api/vietride";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import { formatDateTime } from "../../../utils/date";
import {
  badgeClassFor,
  categoryBadgeClass,
  incidentMapUrl,
  reporterLabel,
  statusBadgeClass,
} from "./incidentHelpers";

type IncidentDetailModalProps = {
  incident: OperatorIncident | null;
  isLoading: boolean;
  onClose: () => void;
};

export default function IncidentDetailModal({
  incident,
  isLoading,
  onClose,
}: IncidentDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const mapUrl = incident ? incidentMapUrl(incident) : null;

  return (
    <Modal
      open={incident !== null || isLoading}
      onClose={onClose}
      icon={<FiAlertTriangle />}
      title={t("incidents.detailTitle")}
      subtitle={t("incidents.detailSubtitle")}
      wide
      footer={
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {isLoading && !incident ? (
        <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
      ) : (
        incident && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassFor(
                  categoryBadgeClass,
                  incident.category,
                  "bg-gray-100 text-gray-700",
                )}`}
              >
                {t(`incidents.categories.${incident.category}`, {
                  defaultValue: incident.category,
                })}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassFor(
                  statusBadgeClass,
                  incident.status,
                  "bg-gray-100 text-gray-700",
                )}`}
              >
                {t(`incidents.statuses.${incident.status}`, {
                  defaultValue: incident.status,
                })}
              </span>
            </div>

            <p className="rounded-xl border border-gray-100 bg-slate-50 p-4 text-sm text-gray-800">
              {incident.description?.trim() || t("incidents.noDescription")}
            </p>

            <DetailSection title={t("incidents.tripInfo")} columns="three">
              <DetailItem
                label={t("incidents.route")}
                value={incident.trip.route.name}
              />
              <DetailItem
                label={t("incidents.departure")}
                value={formatDateTime(incident.trip.departureDateTime)}
              />
              <DetailItem
                label={t("incidents.tripStatus")}
                value={tc(`enumLabels.${incident.trip.status}`, {
                  defaultValue: incident.trip.status,
                })}
              />
              <DetailItem
                label={t("incidents.originStation")}
                value={incident.trip.route.originStation.name}
              />
              <DetailItem
                label={t("incidents.destinationStation")}
                value={incident.trip.route.destinationStation.name}
              />
              <DetailItem
                label={t("incidents.reportedAt")}
                value={formatDateTime(incident.reportedAt)}
              />
            </DetailSection>

            <DetailSection title={t("incidents.reporterInfo")} columns="three">
              <DetailItem
                label={t("incidents.reporter")}
                value={reporterLabel(incident, t("incidents.unknownReporter"))}
              />
              <DetailItem
                label={t("incidents.reporterRole")}
                value={
                  incident.reporter.role
                    ? tc(`roles.${incident.reporter.role}`, {
                        defaultValue: incident.reporter.role,
                      })
                    : "—"
                }
              />
              <DetailItem
                label={t("incidents.location")}
                value={
                  mapUrl ? (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-vr-700 hover:underline"
                    >
                      <FiMapPin size={13} />
                      {t("incidents.openInMaps")}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </DetailSection>

            {incident.photoUrls.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  {t("incidents.photos")}
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {incident.photoUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img
                        src={url}
                        alt={t("incidents.photoAlt")}
                        className="h-32 w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {incident.status === "RESOLVED" && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-emerald-900">
                  {t("incidents.resolvedAt", {
                    value: formatDateTime(incident.resolvedAt ?? undefined),
                  })}
                </p>
                {incident.resolutionNote && (
                  <p className="mt-1 text-emerald-800">
                    {incident.resolutionNote}
                  </p>
                )}
              </div>
            )}

            <Link
              to={`/manager/operations?tripId=${incident.trip.tripId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-vr-700 hover:underline"
            >
              <FiExternalLink size={14} />
              {t("incidents.viewOnOperations")}
            </Link>
          </div>
        )
      )}
    </Modal>
  );
}
