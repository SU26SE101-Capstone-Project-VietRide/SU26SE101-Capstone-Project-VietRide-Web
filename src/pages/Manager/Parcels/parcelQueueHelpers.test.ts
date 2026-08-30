import { describe, expect, it } from "vitest";
import {
  isPreLoadParcelStatus,
  manualCancelRefundChoices,
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
