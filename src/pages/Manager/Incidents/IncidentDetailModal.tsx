// Chi tiết một sự cố. `OPERATOR_ADMIN` đóng được sự cố ngay tại đây; các vai trò
// còn lại chỉ đọc vì BE trả 403 FORBIDDEN cho `PATCH .../resolve`.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiCheckCircle, FiExternalLink } from "react-icons/fi";
import { Link } from "react-router-dom";
import { ApiRequestError } from "../../../api/client";
import {
  resolveOperatorIncident,
  type OperatorIncident,
} from "../../../api/vietride";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import { formatDateTime } from "../../../utils/date";
import {
  badgeClassFor,
  categoryBadgeClass,
  inputClass,
  reporterLabel,
  statusBadgeClass,
} from "./incidentHelpers";

/** Giới hạn của BE sau khi trim; chặn sớm để khỏi ăn 422 VALIDATION_ERROR */
const RESOLUTION_NOTE_MAX_LENGTH = 1000;

type ResolveFormProps = {
  incident: OperatorIncident;
  onResolved: (incident: OperatorIncident) => void;
  onAlreadyResolved: (incidentId: string) => void;
};

/**
 * Form đóng sự cố. Được mount lại theo `key={incidentId}` ở component cha nên
 * ghi chú đang gõ dở của sự cố trước tự mất, không cần effect reset state.
 */
function IncidentResolveForm({
  incident,
  onResolved,
  onAlreadyResolved,
}: ResolveFormProps) {
  const { t } = useTranslation("manager");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  async function handleResolve() {
    if (isResolving) return;

    const note = resolutionNote.trim();
    if (!note) {
      setResolveError(t("incidents.resolveNoteRequired"));
      return;
    }
    if (note.length > RESOLUTION_NOTE_MAX_LENGTH) {
      setResolveError(t("incidents.resolveNoteTooLong"));
      return;
    }

    setIsResolving(true);
    setResolveError("");
    try {
      const updated = await resolveOperatorIncident(incident.incidentId, {
        resolutionNote: note,
      });
      onResolved(updated);
      setResolutionNote("");
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === "INCIDENT_ALREADY_RESOLVED"
      ) {
        // Bản ghi vừa được admin khác đóng: cha tải lại chi tiết nên form này
        // sẽ biến mất, thông báo hiển thị qua toast của màn.
        setResolveError(t("incidents.resolveAlreadyResolved"));
        onAlreadyResolved(incident.incidentId);
        return;
      }
      setResolveError(
        error instanceof Error ? error.message : t("incidents.resolveFailed"),
      );
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <h3 className="text-sm font-bold text-gray-900">
        {t("incidents.resolveTitle")}
      </h3>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">
          {t("incidents.resolveNoteLabel")}
        </span>
        <textarea
          className={`${inputClass} min-h-24`}
          value={resolutionNote}
          maxLength={RESOLUTION_NOTE_MAX_LENGTH}
          placeholder={t("incidents.resolveNotePlaceholder")}
          onChange={(event) => setResolutionNote(event.target.value)}
        />
      </label>
      {resolveError && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {resolveError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleResolve()}
        disabled={isResolving}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiCheckCircle aria-hidden="true" />
        {isResolving ? t("incidents.resolving") : t("incidents.resolveAction")}
      </button>
    </section>
  );
}

type IncidentDetailModalProps = {
  incident: OperatorIncident | null;
  isLoading: boolean;
  onClose: () => void;
  /** Chỉ `OPERATOR_ADMIN`; Staff thấy chú thích thay cho form */
  canResolve: boolean;
  /** Bản ghi BE trả sau khi đóng — dùng thay cho việc tự gán RESOLVED ở client */
  onResolved: (incident: OperatorIncident) => void;
  /** 409 INCIDENT_ALREADY_RESOLVED: admin khác vừa xử lý, phải tải lại */
  onAlreadyResolved: (incidentId: string) => void;
};

export default function IncidentDetailModal({
  incident,
  isLoading,
  onClose,
  canResolve,
  onResolved,
  onAlreadyResolved,
}: IncidentDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const photoUrls = incident?.photoUrls ?? [];

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

            {/* Không hiển thị toạ độ/link bản đồ của điểm báo: nó là vị trí lúc
                tài xế bấm gửi, không phải vị trí hiện tại của xe — muốn xem xe ở
                đâu thì sang Trung tâm vận hành (link ở khối hành động bên dưới). */}
            <DetailSection title={t("incidents.reporterInfo")} columns="two">
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
            </DetailSection>

            {photoUrls.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  {t("incidents.photos")}
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {photoUrls.map((url) => (
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

            {/* Khối hành động: lời nhắc "vận hành không tự đóng sự cố" phải đứng
                NGAY TRÊN form, không phải một hộp màu riêng ở tận đáy — đọc xong
                là thấy luôn chỗ bấm. Sự cố đã xử lý thì thay bằng phần tổng kết. */}
            {incident.status === "RESOLVED" ? (
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
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  {t("incidents.operationsHint")}
                </p>
                {canResolve ? (
                  <IncidentResolveForm
                    key={incident.incidentId}
                    incident={incident}
                    onResolved={onResolved}
                    onAlreadyResolved={onAlreadyResolved}
                  />
                ) : (
                  <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    {t("incidents.resolveStaffHint")}
                  </p>
                )}
              </div>
            )}

            <Link
              to={`/manager/operations?tripId=${incident.trip.tripId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-vr-800 hover:underline"
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
