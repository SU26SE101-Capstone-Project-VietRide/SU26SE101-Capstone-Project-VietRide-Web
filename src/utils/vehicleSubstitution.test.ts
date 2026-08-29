import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../api/client";
import { planSubstitutionError } from "./vehicleSubstitution";

/**
 * Bảng "Validation và lỗi cần hiển thị" của handoff Web Operator "đổi xe do sự
 * cố" (2026-08-30). Mỗi dòng của bảng là một test ở đây: FE không chỉ hiện câu
 * lỗi mà còn phải làm đúng một việc cụ thể cho từng mã.
 */
describe("planSubstitutionError", () => {
  it("xe thay không ACTIVE thì đánh dấu ô xe và bắt tải lại danh sách xe", () => {
    const plan = planSubstitutionError(
      new ApiRequestError("Vehicle is not active", 422, "VEHICLE_NOT_ACTIVE"),
    );

    expect(plan.fields).toEqual(["vehicle"]);
    expect(plan.refreshVehicles).toBe(true);
    expect(plan.closeForm).toBe(false);
  });

  it("chọn lại xe cũ thì chỉ đánh dấu ô xe, không tải lại danh sách", () => {
    const plan = planSubstitutionError(
      new ApiRequestError(
        "Replacement vehicle is the same as the old one",
        409,
        "TRIP_VEHICLE_SAME_AS_OLD",
      ),
    );

    expect(plan.fields).toEqual(["vehicle"]);
    expect(plan.refreshVehicles).toBe(false);
    expect(plan.hintKey).toBe("tripOperations.errorVehicleSameAsOldHint");
  });

  it("chọn lại kíp cũ thì đánh dấu cả tài xế lẫn phụ xe", () => {
    const plan = planSubstitutionError(
      new ApiRequestError(
        "Replacement crew is the same as the old one",
        409,
        "TRIP_CREW_SAME_AS_OLD",
      ),
    );

    expect(plan.fields).toEqual(["driver", "assistant"]);
    expect(plan.closeForm).toBe(false);
  });

  it("trùng lịch xe hoặc kíp thì yêu cầu chọn tài nguyên khác", () => {
    expect(
      planSubstitutionError(
        new ApiRequestError("conflict", 409, "TRIP_VEHICLE_CONFLICT"),
      ),
    ).toMatchObject({
      fields: ["vehicle"],
      hintKey: "tripOperations.errorResourceConflictHint",
    });
    expect(
      planSubstitutionError(
        new ApiRequestError("conflict", 409, "TRIP_CREW_CONFLICT"),
      ),
    ).toMatchObject({
      fields: ["driver", "assistant"],
      hintKey: "tripOperations.errorResourceConflictHint",
    });
  });

  it("chuyến hết quyền đổi xe thì đóng form", () => {
    const plan = planSubstitutionError(
      new ApiRequestError(
        "Trip can no longer be substituted",
        409,
        "TRIP_NOT_SUBSTITUTABLE",
      ),
    );

    expect(plan.closeForm).toBe(true);
    expect(plan.fields).toEqual([]);
  });

  /**
   * `422 VALIDATION_ERROR` gom nhiều nguyên nhân (thiếu crew, sự cố sai chuyến,
   * crew sai role/khác nhà xe). Chỉ `error.fields[]` mới nói được trường nào
   * sai, và tên field đi kèm đường dẫn nên phải khớp theo chuỗi con.
   */
  it("đọc trường sai từ error.fields của 422 VALIDATION_ERROR", () => {
    const plan = planSubstitutionError(
      new ApiRequestError("Validation failed", 422, "VALIDATION_ERROR", [
        { field: "replacementCrew.assistantId", message: "must not be null" },
        { field: "incidentId", message: "incident does not belong to trip" },
      ]),
    );

    expect(new Set(plan.fields)).toEqual(new Set(["assistant", "incident"]));
    expect(plan.hintKey).toBe("tripOperations.errorValidationHint");
    expect(plan.refreshVehicles).toBe(false);
  });

  it("403 nói rõ chỉ OPERATOR_ADMIN được đổi xe", () => {
    const plan = planSubstitutionError(
      new ApiRequestError("Forbidden", 403, "FORBIDDEN"),
    );

    expect(plan.hintKey).toBe("tripOperations.errorForbiddenHint");
    expect(plan.fields).toEqual([]);
  });

  it("lỗi không phải của API thì không đánh dấu gì", () => {
    expect(planSubstitutionError(new Error("network down"))).toEqual({
      code: null,
      fields: [],
      refreshVehicles: false,
      closeForm: false,
      hintKey: null,
    });
  });
});
