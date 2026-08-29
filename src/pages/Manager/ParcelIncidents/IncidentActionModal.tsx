// Các form thao tác trên một sự cố: gán người tìm, ghi kết quả tìm, xác nhận
// tìm thấy, kết thúc, và xác nhận mất.
//
// Gom vào một component vì cả năm đều là "modal nhỏ + vài ô + một nút gửi", và
// cả năm đều trả về DETAIL mới của sự cố — chỗ gọi chỉ cần một đường xử lý.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  assignOperatorParcelIncident,
  declareOperatorParcelIncidentLost,
  getOperatorStations,
  getOperatorStops,
  getOperatorVehicles,
  getOperatorUsers,
  markOperatorParcelIncidentFound,
  PARCEL_CUSTODY_LOCATION_TYPES,
  recordOperatorParcelIncidentSearch,
  resolveOperatorParcelIncident,
  type OperatorUser,
  type OperatorStation,
  type OperatorStop,
  type OperatorVehicle,
  type ParcelCustodyLocationType,
  type ParcelIncidentDetail,
  type ParcelIncidentSearchTask,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import EvidenceUploader from "../../../components/EvidenceUploader";
import {
  isUsableUuid,
  requiresLocationId,
} from "../../../utils/parcelReliability";
import {
  classifyIncidentError,
  type IncidentErrorOutcome,
} from "./incidentHelpers";

export type IncidentActionKind =
  | "ASSIGN"
  | "RECORD_SEARCH"
  | "MARK_FOUND"
  | "RESOLVE"
  | "DECLARE_LOST";

type IncidentActionModalProps = {
  action: IncidentActionKind | null;
  incidentId: string;
  /** Chỉ dùng cho RECORD_SEARCH — task đang được ghi kết quả */
  task: ParcelIncidentSearchTask | null;
  onClose: () => void;
  onDone: (detail: ParcelIncidentDetail, successMessage: string) => void;
  /**
   * Lỗi mà chỗ gọi phải xử lý ở tầng chi tiết chứ không phải hiện trong form:
   * sự cố biến mất, báo cáo chưa duyệt, hoặc state ở BE đã đổi (§9 của guide
   * custody exception).
   */
  onRecoverableError: (outcome: IncidentErrorOutcome, message: string) => void;
};

// Mã kết thúc sự cố. BE có default `DELIVERED_TO_CORRECT_LOCATION` nhưng từ chối
// chuỗi rỗng/null, nên UI luôn gửi một mã cụ thể (§6.8).
const RESOLUTION_CODES = [
  "DELIVERED_TO_CORRECT_LOCATION",
  "RETURNED_TO_SENDER",
  "HANDED_TO_RECIPIENT",
] as const;

export default function IncidentActionModal({
  action,
  incidentId,
  task,
  onClose,
  onDone,
  onRecoverableError,
}: IncidentActionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [found, setFound] = useState(false);
  const [result, setResult] = useState("");

  const [locationType, setLocationType] =
    useState<ParcelCustodyLocationType>("WAREHOUSE");
  const [locationId, setLocationId] = useState("");
  const [locationSnapshot, setLocationSnapshot] = useState("");
  const [locationOptions, setLocationOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [evidence, setEvidence] = useState<string[]>([]);

  const [note, setNote] = useState("");
  const [resolutionCode, setResolutionCode] = useState<string>(
    RESOLUTION_CODES[0],
  );

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form KHÔNG có effect dọn state: chỗ gọi gắn `key` theo thao tác + nhiệm vụ
  // nên đổi thao tác là component được dựng lại từ đầu. Dọn bằng effect vừa là
  // một vòng render thừa, vừa để lọt khoảnh khắc form hiện giá trị của lần
  // trước — đủ để gửi nhầm ghi chú của sự cố khác.
  useEffect(() => {
    if (action !== "ASSIGN") return;

    let ignore = false;

    async function loadAssignees() {
      setIsLoadingUsers(true);

      try {
        const result = await getOperatorUsers({
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          sortBy: "displayName",
          sortDir: "asc",
        });
        if (!ignore) setUsers(result.items);
      } catch {
        // Danh sách hỏng thì vẫn cho nhập tay UUID, không chặn thao tác
        if (!ignore) setUsers([]);
      } finally {
        if (!ignore) setIsLoadingUsers(false);
      }
    }

    void loadAssignees();
    return () => {
      ignore = true;
    };
  }, [action]);

  useEffect(() => {
    if (action !== "MARK_FOUND" || locationType === "WAREHOUSE") return;

    let ignore = false;

    async function loadLocations() {
      setIsLoadingLocations(true);
      setLocationOptions([]);
      setLocationId("");
      try {
        const options =
          locationType === "VEHICLE"
            ? (
                await getOperatorVehicles({
                  page: 1,
                  pageSize: 100,
                  isActive: true,
                })
              ).items.flatMap((vehicle: OperatorVehicle) => {
                const id = vehicle.vehicleId ?? vehicle.id;
                return id ? [{ id, label: vehicle.licensePlate }] : [];
              })
            : locationType === "ROUTE_STOP"
              ? (
                  await getOperatorStops({
                    page: 1,
                    pageSize: 100,
                    isActive: true,
                  })
                ).items.map((stop: OperatorStop) => ({
                  id: stop.id,
                  label: stop.address
                    ? `${stop.name} · ${stop.address}`
                    : stop.name,
                }))
              : (
                  await getOperatorStations({
                    page: 1,
                    pageSize: 100,
                    isActive: true,
                  })
                ).items.flatMap((operatorStation: OperatorStation) => {
                  const station = operatorStation.station;
                  const id = station?.id ?? operatorStation.stationId;
                  return id && station
                    ? [
                        {
                          id,
                          label: station.address
                            ? `${station.name} · ${station.address}`
                            : station.name,
                        },
                      ]
                    : [];
                });

        if (!ignore) setLocationOptions(options);
      } catch {
        if (!ignore) setLocationOptions([]);
      } finally {
        if (!ignore) setIsLoadingLocations(false);
      }
    }

    void loadLocations();
    return () => {
      ignore = true;
    };
  }, [action, locationType]);

  // `EvidenceUploader` đã trả về mảng URL sạch nên không còn gì để tách.
  const evidenceReferences = evidence;

  function validate() {
    if (action === "ASSIGN") {
      // §6.3: `Guid.Empty` chưa có guard ở BE — lọt xuống Domain là 500.
      if (!isUsableUuid(assigneeUserId)) {
        return t("parcelIncidents.assigneeRequired");
      }
      return "";
    }

    if (action === "RECORD_SEARCH") {
      if (!task) return t("parcelIncidents.taskMissing");
      // §6.4: `result` rỗng đi qua Domain exception thành 500.
      if (!result.trim()) return t("parcelIncidents.resultRequired");
      return "";
    }

    if (action === "MARK_FOUND") {
      if (requiresLocationId(locationType) && !isUsableUuid(locationId)) {
        return t("parcelIncidents.locationIdRequired");
      }
      return "";
    }

    return "";
  }

  async function submit() {
    if (!action || isSubmitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (action === "ASSIGN") {
        const detail = await assignOperatorParcelIncident(incidentId, {
          assigneeUserId: assigneeUserId.trim(),
        });
        onDone(detail, t("parcelIncidents.assignSuccess"));
      } else if (action === "RECORD_SEARCH" && task) {
        const detail = await recordOperatorParcelIncidentSearch(incidentId, {
          taskId: task.taskId,
          found,
          result: result.trim(),
          ...(evidenceReferences.length > 0 ? { evidenceReferences } : {}),
        });
        onDone(detail, t("parcelIncidents.searchScanSuccess"));
      } else if (action === "MARK_FOUND") {
        const detail = await markOperatorParcelIncidentFound(incidentId, {
          actualLocationType: locationType,
          ...(requiresLocationId(locationType)
            ? { actualLocationId: locationId.trim() }
            : {}),
          ...(locationSnapshot.trim()
            ? { locationSnapshot: locationSnapshot.trim() }
            : {}),
          ...(evidenceReferences.length > 0 ? { evidenceReferences } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        onDone(detail, t("parcelIncidents.markFoundSuccess"));
      } else if (action === "RESOLVE") {
        const detail = await resolveOperatorParcelIncident(incidentId, {
          resolutionCode,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        onDone(detail, t("parcelIncidents.resolveSuccess"));
      } else if (action === "DECLARE_LOST") {
        const detail = await declareOperatorParcelIncidentLost(incidentId, {
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        onDone(detail, t("parcelIncidents.declareLostSuccess"));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("parcelIncidents.actionFailed");
      const outcome = classifyIncidentError(err);

      // `availableActions` trên tay đã cũ (báo cáo chưa duyệt, sự cố đã đóng,
      // task đã bị huỷ...): bắt người dùng bấm lại vào chỗ chắc chắn hỏng là vô
      // ích — trả về tầng chi tiết để nạp lại rồi dựng đúng bộ nút.
      if (outcome !== "SHOW") {
        onRecoverableError(outcome, message);
        return;
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!action) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={t(`parcelIncidents.actions.${action}`)}
      subtitle={
        action === "RECORD_SEARCH" && task
          ? t(`parcelIncidents.taskTypes.${task.taskType}`, {
              defaultValue: task.taskType,
            })
          : undefined
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant={action === "DECLARE_LOST" ? "danger" : "primary"}
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? tc("processing")
              : t(`parcelIncidents.actions.${action}`)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {action === "ASSIGN" && (
          <>
            <label className="block">
              <span className={labelClass}>
                {t("parcelIncidents.assigneeLabel")}
              </span>
              <CustomSelect
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value)}
                className={inputClass}
                aria-label={t("parcelIncidents.assigneeLabel")}
                disabled={isSubmitting}
                searchable
                searchPlaceholder={tc("searchOptions", {
                  label: t("parcelIncidents.assigneeLabel"),
                })}
                emptyMessage={tc("noMatchingOptions")}
              >
                <option value="">
                  {isLoadingUsers
                    ? tc("loading")
                    : t("parcelIncidents.assigneePlaceholder")}
                </option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.displayName} · {user.role}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <p className="text-xs text-gray-500">
              {t("parcelIncidents.assignHint")}
            </p>
          </>
        )}

        {action === "RECORD_SEARCH" && (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
              <p className="text-xs text-gray-500">
                {t("parcelIncidents.taskLocation")}
              </p>
              <p className="mt-0.5 font-semibold text-gray-800">
                {task?.location?.trim() || t("parcelIncidents.unknownLocation")}
              </p>
            </div>
            <fieldset>
              <legend className={labelClass}>
                {t("parcelIncidents.searchOutcome")}
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFound(false)}
                  aria-pressed={!found}
                  className={`min-h-10 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    found
                      ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                  }`}
                >
                  {t("parcelIncidents.searchNotFound")}
                </button>
                <button
                  type="button"
                  onClick={() => setFound(true)}
                  aria-pressed={found}
                  className={`min-h-10 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    found
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t("parcelIncidents.searchFound")}
                </button>
              </div>
            </fieldset>
            <label className="block">
              <span className={labelClass}>
                {t("parcelIncidents.resultLabel")}
              </span>
              <textarea
                value={result}
                onChange={(event) => setResult(event.target.value)}
                rows={3}
                maxLength={1000}
                disabled={isSubmitting}
                placeholder={t("parcelIncidents.resultPlaceholder")}
                className={textareaClass}
              />
            </label>
            <EvidenceField
              value={evidence}
              onChange={setEvidence}
              disabled={isSubmitting}
            />
          </>
        )}

        {action === "MARK_FOUND" && (
          <>
            <label className="block">
              <span className={labelClass}>
                {t("parcelIncidents.locationTypeLabel")}
              </span>
              <CustomSelect
                value={locationType}
                onChange={(event) =>
                  setLocationType(
                    event.target.value as ParcelCustodyLocationType,
                  )
                }
                className={inputClass}
                aria-label={t("parcelIncidents.locationTypeLabel")}
                disabled={isSubmitting}
              >
                {PARCEL_CUSTODY_LOCATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`parcelIncidents.locationTypes.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>
            {/* VEHICLE là loại DUY NHẤT không cần id địa điểm (§6.5) */}
            {requiresLocationId(locationType) && (
              <label className="block">
                <span className={labelClass}>
                  {t("parcelIncidents.locationIdLabel")}
                </span>
                {locationType === "WAREHOUSE" ? (
                  <input
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    disabled={isSubmitting}
                    placeholder={t("parcelIncidents.locationIdPlaceholder")}
                    className={inputClass}
                  />
                ) : (
                  <CustomSelect
                    value={locationId}
                    onChange={(event) => {
                      const option = locationOptions.find(
                        (item) => item.id === event.target.value,
                      );
                      setLocationId(event.target.value);
                      if (option && !locationSnapshot.trim()) {
                        setLocationSnapshot(option.label);
                      }
                    }}
                    className={inputClass}
                    aria-label={t("parcelIncidents.locationIdLabel")}
                    disabled={isSubmitting || isLoadingLocations}
                    searchable
                    searchPlaceholder={tc("searchOptions", {
                      label: t("parcelIncidents.locationIdLabel"),
                    })}
                    emptyMessage={tc("noMatchingOptions")}
                  >
                    <option value="">
                      {isLoadingLocations
                        ? tc("loading")
                        : t("parcelIncidents.locationOptionPlaceholder")}
                    </option>
                    {locationOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                )}
              </label>
            )}
            <label className="block">
              <span className={labelClass}>
                {t("parcelIncidents.locationSnapshotLabel")}
              </span>
              <input
                value={locationSnapshot}
                onChange={(event) => setLocationSnapshot(event.target.value)}
                disabled={isSubmitting}
                placeholder={t("parcelIncidents.locationSnapshotPlaceholder")}
                className={inputClass}
              />
            </label>
            <EvidenceField
              value={evidence}
              onChange={setEvidence}
              disabled={isSubmitting}
            />
            <NoteField
              value={note}
              onChange={setNote}
              disabled={isSubmitting}
            />
          </>
        )}

        {action === "RESOLVE" && (
          <>
            <label className="block">
              <span className={labelClass}>
                {t("parcelIncidents.resolutionCodeLabel")}
              </span>
              <CustomSelect
                value={resolutionCode}
                onChange={(event) => setResolutionCode(event.target.value)}
                className={inputClass}
                aria-label={t("parcelIncidents.resolutionCodeLabel")}
                disabled={isSubmitting}
              >
                {RESOLUTION_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t(`parcelIncidents.resolutionCodes.${code}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <NoteField
              value={note}
              onChange={setNote}
              disabled={isSubmitting}
            />
          </>
        )}

        {action === "DECLARE_LOST" && (
          <>
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {t("parcelIncidents.declareLostWarning")}
            </p>
            <NoteField
              value={note}
              onChange={setNote}
              disabled={isSubmitting}
            />
          </>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function EvidenceField({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("manager");

  return (
    <EvidenceUploader
      purpose="INCIDENT_PHOTO"
      value={value}
      onChange={onChange}
      disabled={disabled}
      label={t("parcelIncidents.evidenceLabel")}
      hint={t("parcelIncidents.evidenceHint")}
    />
  );
}

function NoteField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <label className="block">
      <span className={labelClass}>{tc("note")}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={1000}
        disabled={disabled}
        placeholder={t("parcelIncidents.notePlaceholder")}
        className={textareaClass}
      />
    </label>
  );
}
