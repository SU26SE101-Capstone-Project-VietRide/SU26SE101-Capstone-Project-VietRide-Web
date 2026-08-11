import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../api/client";
import {
  isResourceConflictError,
  parseResourceConflictError,
} from "./resourceConflict";

function conflictError(
  code: string,
  fields: Array<{ field: string; message: string }>,
  status = 409,
) {
  return new ApiRequestError("conflict", status, code, fields);
}

describe("parseResourceConflictError", () => {
  // ASSISTANT dùng chung code TRIP_DRIVER_CONFLICT với DRIVER vì guard của BE
  // chỉ tách VEHICLE và non-vehicle — chỉ resourceRole mới phân biệt được
  // (handoff API-driver-resource-availability mục 6.2 và 14.1).
  it("phân biệt ASSISTANT với DRIVER qua resourceRole", () => {
    const parsed = parseResourceConflictError(
      conflictError("TRIP_DRIVER_CONFLICT", [
        { field: "conflictReason", message: "REPOSITION_REQUIRED" },
        { field: "resourceRole", message: "ASSISTANT" },
        { field: "resourceId", message: "assistant-1" },
        { field: "conflictingSourceType", message: "TRIP" },
        { field: "conflictingSourceId", message: "trip-9" },
        { field: "blockingUntil", message: "2026-08-12T10:00:00.0000000+00:00" },
      ]),
    );

    expect(parsed).toEqual({
      code: "TRIP_DRIVER_CONFLICT",
      reason: "REPOSITION_REQUIRED",
      resourceRole: "ASSISTANT",
      resourceId: "assistant-1",
      conflictingSourceType: "TRIP",
      conflictingSourceId: "trip-9",
      blockingUntil: "2026-08-12T10:00:00.0000000+00:00",
    });
  });

  it.each([
    "TRIP_VEHICLE_CONFLICT",
    "TRIP_CREW_CONFLICT",
    "SHUTTLE_DRIVER_CONFLICT",
    "SHUTTLE_VEHICLE_CONFLICT",
  ])("nhận diện %s là conflict tài nguyên", (code) => {
    expect(isResourceConflictError(conflictError(code, []))).toBe(true);
  });

  it("bỏ qua lỗi 409 không phải conflict tài nguyên", () => {
    const error = conflictError("SCHEDULE_HAS_TRIPS", [
      { field: "tripCount", message: "3" },
    ]);

    expect(isResourceConflictError(error)).toBe(false);
    expect(parseResourceConflictError(error)).toBeNull();
  });

  it("bỏ qua conflict code nhưng sai status", () => {
    expect(
      parseResourceConflictError(
        conflictError("TRIP_DRIVER_CONFLICT", [], 422),
      ),
    ).toBeNull();
  });

  it("trả null cho field không nhận diện được thay vì gán bừa", () => {
    const parsed = parseResourceConflictError(
      conflictError("SHUTTLE_VEHICLE_CONFLICT", [
        { field: "conflictReason", message: "SOMETHING_NEW" },
        { field: "resourceRole", message: "ROBOT" },
      ]),
    );

    expect(parsed?.reason).toBeNull();
    expect(parsed?.resourceRole).toBeNull();
    expect(parsed?.blockingUntil).toBeNull();
  });

  it("bỏ qua lỗi không phải ApiRequestError", () => {
    expect(parseResourceConflictError(new Error("boom"))).toBeNull();
    expect(isResourceConflictError(null)).toBe(false);
  });
});
