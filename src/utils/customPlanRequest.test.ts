// Shape response custom-request đã xác nhận từ bản chạy thật 2026-08-21.
// Regression: bảng admin từng hiện "xe · tuyến" trống vì FE đọc tên field đoán
// từ spec (phẳng ở gốc) trong khi BE đặt trong requestedLimits/requestedModules.
import { describe, expect, it } from "vitest";
import type { AdminCustomPlanRequest } from "../api/vietride";
import { operatorLabel, toCustomPlanRequestView } from "./customPlanRequest";

const raw: AdminCustomPlanRequest = {
  requestId: "0859b6da-3130-42b9-b198-a9fced45f932",
  operatorId: "e17f537d-ba9a-4e11-854a-e40480c81f12",
  operatorName: "Nhà xe Phương Trang",
  status: "PENDING_REVIEW",
  preferredBillingPeriod: "YEARLY",
  note: null,
  requestedLimits: {
    maxVehicles: 200,
    maxDrivers: 400,
    maxAssistants: 400,
    maxOperatorUsers: 50,
    maxRoutes: 200,
    maxTripsPerMonth: 20000,
  },
  requestedModules: {
    enableParcel: true,
    enableShuttle: true,
    enableRag: true,
  },
  approvedPlanId: null,
  rejectionReason: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-08-21T18:43:00.299711+07:00",
  updatedAt: "2026-08-21T18:43:00.299711+07:00",
};

describe("toCustomPlanRequestView", () => {
  it("flattens requestedLimits and requestedModules into one quota object", () => {
    expect(toCustomPlanRequestView(raw).quota).toEqual({
      maxVehicles: 200,
      maxDrivers: 400,
      maxAssistants: 400,
      maxOperatorUsers: 50,
      maxRoutes: 200,
      maxTripsPerMonth: 20000,
      enableParcel: true,
      enableShuttle: true,
      enableRag: true,
    });
  });

  it("turns the nullable text fields into empty strings", () => {
    // UI hiển thị thẳng các field này nên không được để lọt null ra template
    const view = toCustomPlanRequestView(raw);

    expect(view.note).toBe("");
    expect(view.rejectionReason).toBe("");
    expect(view.approvedPlanId).toBe("");
    expect(view.reviewedAt).toBe("");
  });

  it("carries the identifiers and status through", () => {
    const view = toCustomPlanRequestView(raw);

    expect(view.requestId).toBe("0859b6da-3130-42b9-b198-a9fced45f932");
    expect(view.operatorId).toBe("e17f537d-ba9a-4e11-854a-e40480c81f12");
    expect(view.status).toBe("PENDING_REVIEW");
    expect(view.preferredBillingPeriod).toBe("YEARLY");
  });
});

describe("operatorLabel", () => {
  it("uses the operator name the backend now returns", () => {
    expect(operatorLabel(toCustomPlanRequestView(raw))).toBe(
      "Nhà xe Phương Trang",
    );
  });

  it("falls back to a shortened id when the name is missing", () => {
    // BE cam kết luôn có tên, nhưng một dòng trống không được làm ô nhà xe
    // rỗng trơn — admin mất khả năng phân biệt hai dòng
    const view = toCustomPlanRequestView({ ...raw, operatorName: "" });

    expect(operatorLabel(view)).toBe("e17f537d");
  });
});
