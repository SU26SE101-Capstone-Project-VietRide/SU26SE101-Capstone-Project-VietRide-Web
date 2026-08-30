import { ApiRequestError } from "../api/client";

/**
 * Ánh xạ lỗi của `POST /v1/operator/trips/{tripId}/substitute-vehicle` sang
 * việc mà form phải làm (handoff Web Operator "đổi xe do sự cố", 2026-08-30,
 * bảng "Validation và lỗi cần hiển thị").
 *
 * Tách khỏi component vì bảng này là HỢP ĐỒNG với BE: mỗi mã lỗi ứng với một
 * thao tác cụ thể (đánh dấu trường nào, có phải tải lại danh sách xe không, có
 * phải đóng form không), và nó cần test riêng chứ không lẫn vào test render.
 */
export type SubstitutionFormField =
  | "incident"
  | "vehicle"
  | "driver"
  | "assistant"
  | "reason"
  | "recoveryDeparture";

export type SubstitutionErrorPlan = {
  code: string | null;
  /** Trường bắt buộc phải đánh dấu lỗi và giữ nguyên giá trị người dùng đã nhập */
  fields: SubstitutionFormField[];
  /** Danh sách xe FE đang giữ đã cũ — tải lại rồi bắt chọn xe khác */
  refreshVehicles: boolean;
  /** Chuyến hết quyền đổi xe — đóng form, bắt trang cha tải lại trạng thái chuyến */
  closeForm: boolean;
  /** Câu hướng dẫn bước tiếp theo (namespace `manager`), null = chỉ hiện message của BE */
  hintKey: string | null;
};

const CREW_FIELDS: SubstitutionFormField[] = ["driver", "assistant"];

/**
 * `error.fields[]` của BE là ARRAY `{field, message}` chứ không phải object
 * map. Tên field đi kèm đường dẫn (`replacementCrew.driverId`) nên khớp theo
 * CHUỖI CON, không so bằng.
 */
function fieldsFromValidationError(
  error: ApiRequestError,
): SubstitutionFormField[] {
  const marked = new Set<SubstitutionFormField>();

  for (const detail of error.fields) {
    const name = detail.field.toLowerCase();
    if (name.includes("incident")) marked.add("incident");
    if (name.includes("vehicle")) marked.add("vehicle");
    if (name.includes("driver")) marked.add("driver");
    if (name.includes("assistant")) marked.add("assistant");
    if (name.includes("reason")) marked.add("reason");
    if (name.includes("recovery") || name.includes("departure")) {
      marked.add("recoveryDeparture");
    }
  }

  return [...marked];
}

export function planSubstitutionError(error: unknown): SubstitutionErrorPlan {
  const empty: SubstitutionErrorPlan = {
    code: null,
    fields: [],
    refreshVehicles: false,
    closeForm: false,
    hintKey: null,
  };

  if (!(error instanceof ApiRequestError)) return empty;

  const code = error.code ?? null;

  switch (code) {
    // 422 — xe thay không còn ACTIVE. Danh sách FE đang giữ đã cũ.
    case "VEHICLE_NOT_ACTIVE":
      return {
        code,
        fields: ["vehicle"],
        refreshVehicles: true,
        closeForm: false,
        hintKey: "tripOperations.errorVehicleNotActiveHint",
      };
    // 409 — chọn lại đúng xe của chuyến cũ.
    case "TRIP_VEHICLE_SAME_AS_OLD":
      return {
        code,
        fields: ["vehicle"],
        refreshVehicles: false,
        closeForm: false,
        hintKey: "tripOperations.errorVehicleSameAsOldHint",
      };
    // 409 — chọn lại tài xế hoặc phụ xe của chuyến cũ.
    case "TRIP_CREW_SAME_AS_OLD":
      return {
        code,
        fields: CREW_FIELDS,
        refreshVehicles: false,
        closeForm: false,
        hintKey: "tripOperations.errorCrewSameAsOldHint",
      };
    // 409 — trùng lịch, phải chọn tài nguyên khác.
    case "TRIP_VEHICLE_CONFLICT":
      return {
        code,
        fields: ["vehicle"],
        refreshVehicles: false,
        closeForm: false,
        hintKey: "tripOperations.errorResourceConflictHint",
      };
    case "TRIP_CREW_CONFLICT":
    case "TRIP_DRIVER_CONFLICT":
      return {
        code,
        fields: CREW_FIELDS,
        refreshVehicles: false,
        closeForm: false,
        hintKey: "tripOperations.errorResourceConflictHint",
      };
    // 409 — chuyến không còn được phép đổi xe: đóng form, tải lại trạng thái.
    case "TRIP_NOT_SUBSTITUTABLE":
    case "TRIP_NOT_EDITABLE":
    case "TRIP_ALREADY_TERMINAL":
      return {
        code,
        fields: [],
        refreshVehicles: false,
        closeForm: true,
        hintKey: "tripOperations.errorNotSubstitutableHint",
      };
    default:
      break;
  }

  // 403 — chỉ OPERATOR_ADMIN được đổi xe; STAFF chỉ xem.
  if (error.status === 403) {
    return {
      code,
      fields: [],
      refreshVehicles: false,
      closeForm: false,
      hintKey: "tripOperations.errorForbiddenHint",
    };
  }

  // 422 VALIDATION_ERROR gom nhiều nguyên nhân (thiếu crew, incident sai
  // chuyến, crew sai role/khác nhà xe) — chỉ `error.fields[]` mới nói được
  // trường nào sai, nên đọc từ đó thay vì đoán theo code.
  if (error.status === 422) {
    const fields = fieldsFromValidationError(error);
    return {
      code,
      fields,
      refreshVehicles: false,
      closeForm: false,
      hintKey: fields.length ? "tripOperations.errorValidationHint" : null,
    };
  }

  return { ...empty, code };
}
