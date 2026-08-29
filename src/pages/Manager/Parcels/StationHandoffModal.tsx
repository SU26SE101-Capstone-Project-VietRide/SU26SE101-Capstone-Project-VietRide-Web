// Ghi nhận bàn giao kiện hàng tại bến (§10.6 API-Parcel-Operator-2026-08-21.md).
//
// Tự chứa: nhận `parcelId`/`parcelCode` của kiện đang mở rồi tự gọi API, tự giữ
// lỗi. Sự kiện custody không đổi trạng thái Parcel nên màn cha không cần tải lại.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiTruck } from "react-icons/fi";
import {
  getOperatorStations,
  PARCEL_CUSTODY_LOCATION_TYPES,
  recordParcelStationHandoff,
  type OperatorStation,
  type ParcelCustodyLocationType,
  type ParcelStationHandoffRequest,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import { requiresLocationId } from "../../../utils/parcelReliability";
import EvidenceUploader from "../../../components/EvidenceUploader";

type StationHandoffModalProps = {
  open: boolean;
  parcelId: string;
  parcelCode: string;
  onClose: () => void;
  onRecorded: (message: string) => void;
};

/** Controller chỉ nhận đúng hai loại sự kiện này. */
const EVENT_TYPES = ["HANDOFF", "RETURNED_TO_STATION"] as const;

/** Bến/kho của nhà xe hiếm khi tới trăm cái; lấy một lượt cho gọn. */
const STATION_PAGE_SIZE = 100;

function stationLabel(station: OperatorStation) {
  return (
    station.displayNameOverride?.trim() ||
    station.station?.name ||
    station.stationId ||
    station.id ||
    ""
  );
}

function stationValue(station: OperatorStation) {
  return station.stationId ?? station.id ?? "";
}

export default function StationHandoffModal({
  open,
  parcelId,
  parcelCode,
  onClose,
  onRecorded,
}: StationHandoffModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [eventType, setEventType] =
    useState<(typeof EVENT_TYPES)[number]>("HANDOFF");
  const [locationType, setLocationType] =
    useState<ParcelCustodyLocationType>("WAREHOUSE");
  const [locationId, setLocationId] = useState("");
  const [locationSnapshot, setLocationSnapshot] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stations, setStations] = useState<OperatorStation[]>([]);
  const [stationsLoaded, setStationsLoaded] = useState(false);

  // Chỉ tải khi thật sự mở hộp thoại — chi tiết kiện được mở rất nhiều lần mà
  // phần lớn không đụng tới bàn giao.
  useEffect(() => {
    if (!open || stationsLoaded) return;

    let ignore = false;
    void getOperatorStations({
      page: 1,
      pageSize: STATION_PAGE_SIZE,
      sortBy: "name",
      sortDir: "asc",
    })
      .then((result) => {
        if (ignore) return;
        setStations(result.items);
        setStationsLoaded(true);
      })
      .catch(() => {
        // Không chặn hộp thoại: người dùng vẫn đọc được cảnh báo bên dưới và
        // đóng lại, hơn là nhìn một form trắng không giải thích gì.
        if (!ignore) setStationsLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [open, stationsLoaded]);

  const needsLocationId = requiresLocationId(locationType);

  function handleClose() {
    setError("");
    onClose();
  }

  function selectStation(nextId: string) {
    setError("");
    setLocationId(nextId);

    // `locationSnapshot` mới là thứ người đi tìm hàng đọc được ở màn Sự cố —
    // backend KHÔNG tra tên từ mã vị trí, nó chỉ lưu lại nguyên chuỗi này. Điền
    // sẵn tên bến để không ai phải nhớ, nhưng không đè lên chữ người dùng gõ.
    if (locationSnapshot.trim()) return;
    const station = stations.find((item) => stationValue(item) === nextId);
    if (station) setLocationSnapshot(stationLabel(station));
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    // `actualLocationId` bắt buộc với mọi loại trừ VEHICLE, nếu không BE trả
    // 422 PARCEL_CUSTODY_LOCATION_REQUIRED.
    if (needsLocationId && !locationId) {
      setError(t("parcels.handoff.errors.location-required"));
      return;
    }

    const request: ParcelStationHandoffRequest = {
      parcelCode,
      eventType,
      actualLocationType: locationType,
      ...(needsLocationId ? { actualLocationId: locationId } : {}),
      ...(locationSnapshot.trim()
        ? { locationSnapshot: locationSnapshot.trim() }
        : {}),
      evidenceReferences: evidence,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };

    setIsSubmitting(true);
    setError("");
    try {
      await recordParcelStationHandoff(parcelId, request);
      onRecorded(t("parcels.handoff.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parcels.handoff.failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      icon={<FiTruck size={20} />}
      title={t("parcels.handoff.title")}
      subtitle={parcelCode}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {t("parcels.handoff.submit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Người dùng mở hộp thoại này lần đầu không có cách nào đoán ra nó để
            làm gì — nói thẳng mục đích và cái giá của việc bỏ qua. */}
        <div className="rounded-xl border border-vr-200 bg-vr-50 px-4 py-3">
          <p className="text-sm font-semibold text-vr-900">
            {t("parcels.handoff.purposeTitle")}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-700">
            {t("parcels.handoff.purposeBody")}
          </p>
        </div>

        {error ? (
          <InlineAlert tone="error">
            <p>{error}</p>
          </InlineAlert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              {t("parcels.handoff.eventTypeLabel")}
            </label>
            <CustomSelect
              aria-label={t("parcels.handoff.eventTypeLabel")}
              className={inputClass}
              value={eventType}
              onChange={(event) => {
                setError("");
                setEventType(
                  event.target.value as (typeof EVENT_TYPES)[number],
                );
              }}
            >
              {EVENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`parcels.handoff.eventTypes.${value}`)}
                </option>
              ))}
            </CustomSelect>
            {/* Hai loại sự kiện nghe gần giống nhau — giải thích ngay dưới ô */}
            <p className="mt-1 text-xs text-gray-600">
              {t(`parcels.handoff.eventTypeHints.${eventType}`)}
            </p>
          </div>
          <div>
            <label className={labelClass}>
              {t("parcels.handoff.locationTypeLabel")}
            </label>
            <CustomSelect
              aria-label={t("parcels.handoff.locationTypeLabel")}
              className={inputClass}
              value={locationType}
              onChange={(event) => {
                setError("");
                setLocationType(
                  event.target.value as ParcelCustodyLocationType,
                );
              }}
            >
              {PARCEL_CUSTODY_LOCATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`parcelIncidents.locationTypes.${value}`, {
                    defaultValue: value,
                  })}
                </option>
              ))}
            </CustomSelect>
          </div>
          {needsLocationId && (
            <div>
              <label className={labelClass}>
                {t("parcels.handoff.stationLabel")}
                <span className="text-rose-700"> *</span>
              </label>
              <CustomSelect
                aria-label={t("parcels.handoff.stationLabel")}
                className={inputClass}
                value={locationId}
                searchable
                disabled={!stationsLoaded}
                emptyMessage={t("parcels.handoff.stationEmpty")}
                onChange={(event) => selectStation(event.target.value)}
              >
                <option value="">
                  {t("parcels.handoff.stationPlaceholder")}
                </option>
                {stations.map((station) => (
                  <option key={station.id} value={stationValue(station)}>
                    {stationLabel(station)}
                  </option>
                ))}
              </CustomSelect>
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="handoff-location-snapshot">
              {t("parcels.handoff.locationSnapshotLabel")}
            </label>
            <input
              id="handoff-location-snapshot"
              type="text"
              value={locationSnapshot}
              onChange={(event) => setLocationSnapshot(event.target.value)}
              placeholder={t("parcels.handoff.locationSnapshotPlaceholder")}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-600">
              {t("parcels.handoff.locationSnapshotHint")}
            </p>
          </div>
        </div>

        <EvidenceUploader
          purpose="PARCEL_EVIDENCE_PHOTO"
          value={evidence}
          onChange={setEvidence}
          label={t("parcels.handoff.evidenceLabel")}
          hint={t("parcels.handoff.evidenceHint")}
        />

        <div>
          <label className={labelClass} htmlFor="handoff-reason">
            {t("parcels.handoff.reasonLabel")}
          </label>
          {/* Cột `reason` của ParcelCustodyEvent giới hạn 1000 ký tự — chặn
              ngay ở form thay vì để BE trả 422 sau khi người dùng gõ xong. */}
          <textarea
            id="handoff-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${textareaClass} resize-y`}
          />
        </div>

        {/* BE đối chiếu `parcelCode` với kiện thật; lệch là 409
            SCAN_IDENTITY_MISMATCH chứ không phải lỗi nhập liệu thường. */}
        <InlineAlert tone="info">
          <p>{t("parcels.handoff.identityNote")}</p>
        </InlineAlert>
      </div>
    </Modal>
  );
}
