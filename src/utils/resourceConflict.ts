import { ApiRequestError } from "../api/client";
import type {
  ResourceConflictReason,
  ResourceRole,
} from "../api/vietride";

// Conflict availability (driver/assistant/vehicle) được BE trả theo hai dạng
// khác nhau và FE phải xử lý cả hai (handoff API-driver-resource-availability):
//   - preview: HTTP 200 kèm ResourceAvailabilityResult.available=false (mục 6.1)
//   - mutation: HTTP 409, chi tiết nằm trong error.fields[] (mục 6.2)
// Riêng ASSISTANT dùng chung code TRIP_DRIVER_CONFLICT với DRIVER, nên chỉ có
// error.fields.resourceRole mới phân biệt được (mục 14.1).

const RESOURCE_CONFLICT_CODES = new Set([
  "TRIP_DRIVER_CONFLICT",
  "TRIP_VEHICLE_CONFLICT",
  "TRIP_CREW_CONFLICT",
  "SHUTTLE_DRIVER_CONFLICT",
  "SHUTTLE_VEHICLE_CONFLICT",
]);

const CONFLICT_REASONS = new Set<ResourceConflictReason>([
  "TIME_OVERLAP",
  "TURNAROUND_REQUIRED",
  "REPOSITION_REQUIRED",
  "RESOURCE_ACTIVE",
]);

const RESOURCE_ROLES = new Set<ResourceRole>([
  "DRIVER",
  "ASSISTANT",
  "VEHICLE",
]);

export type ParsedResourceConflict = {
  code: string;
  reason: ResourceConflictReason | null;
  resourceRole: ResourceRole | null;
  resourceId: string | null;
  conflictingSourceType: string | null;
  conflictingSourceId: string | null;
  blockingUntil: string | null;
};

export function isResourceConflictError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.status === 409 &&
    Boolean(error.code) &&
    RESOURCE_CONFLICT_CODES.has(error.code as string)
  );
}

// error.fields là ARRAY {field,message}, không phải object map (mục 3.1).
export function parseResourceConflictError(
  error: unknown,
): ParsedResourceConflict | null {
  if (!isResourceConflictError(error)) {
    return null;
  }

  const apiError = error as ApiRequestError;
  const fields = new Map(
    apiError.fields.map((field) => [field.field, field.message]),
  );
  const reason = fields.get("conflictReason") as ResourceConflictReason;
  const role = fields.get("resourceRole") as ResourceRole;

  return {
    code: apiError.code as string,
    reason: CONFLICT_REASONS.has(reason) ? reason : null,
    resourceRole: RESOURCE_ROLES.has(role) ? role : null,
    resourceId: fields.get("resourceId") ?? null,
    conflictingSourceType: fields.get("conflictingSourceType") ?? null,
    conflictingSourceId: fields.get("conflictingSourceId") ?? null,
    blockingUntil: fields.get("blockingUntil") ?? null,
  };
}

export function conflictReasonKey(reason: ResourceConflictReason | null) {
  return reason
    ? `resourceConflict.reason.${reason}`
    : "resourceConflict.reason.UNKNOWN";
}

export function resourceRoleKey(role: ResourceRole | null) {
  return role ? `resourceConflict.role.${role}` : "resourceConflict.role.UNKNOWN";
}
