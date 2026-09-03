import { describe, expect, it } from "vitest";
import {
  canRecordStationHandoff,
  isPreLoadParcelStatus,
  manualCancelRefundChoices,
  parcelStatusLabel,
  pendingActionLabel,
} from "./parcelQueueHelpers";

// `t` giả trả về chính key để test nhìn thấy màn CHỌN key nào.
const t = (key: string) => key;

// Giữ khớp với `ParcelTripCancellationClassifier.IsPreLoad` của BE. Lệch danh
// sách này là người dùng bấm huỷ rồi ăn 409, hoặc mất nút ở đơn huỷ được.
describe("isPreLoadParcelStatus", () => {
  it("nhận đủ tám trạng thái trước khi hàng lên xe", () => {
    [
      "PENDING_OPERATOR_REVIEW",
      "PENDING_PAYMENT",
      "PENDING",
      "PENDING_ADDITIONAL_PAYMENT",
      "RESERVED",
      "CHECKED_IN",
      "PENDING_FINAL_PAYMENT",
      "READY_TO_LOAD",
    ].forEach((status) => {
      expect(isPreLoadParcelStatus(status)).toBe(true);
    });
  });

  it("từ chối mọi trạng thái từ lúc lên hàng trở đi", () => {
    ["LOADED", "IN_TRANSIT", "UNLOADED", "DELIVERED_PENDING_CONFIRM",
      "DELIVERY_CONFIRMED", "RETURNED", "CANCELLED", "REJECTED"].forEach(
      (status) => {
        expect(isPreLoadParcelStatus(status)).toBe(false);
      },
    );
  });

  it("không nổ khi chưa có đơn nào được chọn", () => {
    expect(isPreLoadParcelStatus(null)).toBe(false);
    expect(isPreLoadParcelStatus(undefined)).toBe(false);
    expect(isPreLoadParcelStatus("")).toBe(false);
  });
});

describe("manualCancelRefundChoices", () => {
  // BE mặc định POLICY khi bỏ trống, nên nó phải là lựa chọn đầu tiên trong ô.
  it("mở sẵn ở lựa chọn mặc định của backend", () => {
    expect(manualCancelRefundChoices[0]).toBe("POLICY_REFUND");
    expect(manualCancelRefundChoices).toEqual([
      "POLICY_REFUND",
      "FULL_REFUND",
      "NO_REFUND",
    ]);
  });
});

// Bốn giá trị của `PendingActionType` phía BE. Thiếu một cái là ô "Việc cần làm"
// hiện tên enum thô cho người dùng — đúng lỗi CUSTODY_EXCEPTION đã gặp.
describe("pendingActionLabel", () => {
  it("dịch đủ bốn loại việc cần làm", () => {
    [
      "REFUND_CONFIRMATION",
      "CAPACITY_EXCEEDED",
      "RESERVE_FAILED",
      "CUSTODY_EXCEPTION",
    ].forEach((type) => {
      expect(pendingActionLabel(type, t)).toBe(`parcels.pendingActions.${type}`);
    });
  });

  it("loại lạ thì hiện tên đọc được thay vì gạch dưới", () => {
    expect(pendingActionLabel("SOMETHING_NEW", t)).toBe("SOMETHING NEW");
    expect(pendingActionLabel(null, t)).toBe("");
  });
});

describe("parcelStatusLabel", () => {
  it("ưu tiên loại xử lý cụ thể thay cho trạng thái kỹ thuật tổng quát", () => {
    expect(
      parcelStatusLabel("PENDING_OPERATOR_ACTION", "CUSTODY_EXCEPTION", t, t),
    ).toBe("parcels.pendingActions.CUSTODY_EXCEPTION");
  });

  it("giữ nhãn trạng thái thông thường khi không có pending action", () => {
    expect(parcelStatusLabel("IN_TRANSIT", null, t, t)).toBe(
      "enumLabels.IN_TRANSIT",
    );
  });
});

describe("canRecordStationHandoff", () => {
  it("chỉ cho ghi bù trong giai đoạn đang giữ/vận chuyển hoặc hoàn về bến", () => {
    [
      "CHECKED_IN",
      "PENDING_FINAL_PAYMENT",
      "READY_TO_LOAD",
      "LOADED",
      "IN_TRANSIT",
      "PENDING_TRANSFER_CONFIRM",
      "TRANSFER_ESCALATED",
      "UNLOADED",
      "DELIVERY_REJECTED",
      "RETURN_INITIATED",
      "RETURNED",
    ].forEach((status) => expect(canRecordStationHandoff(status)).toBe(true));
  });

  it("ẩn ở giai đoạn đặt/thu tiền, chờ xử lý và trạng thái kết thúc", () => {
    [
      "PENDING_OPERATOR_REVIEW",
      "PENDING_PAYMENT",
      "PENDING_OPERATOR_ACTION",
      "DELIVERED_PENDING_CONFIRM",
      "DELIVERY_CONFIRMED",
      "CANCELLED",
      "REJECTED",
      "EXPIRED",
    ].forEach((status) => expect(canRecordStationHandoff(status)).toBe(false));
  });
});
