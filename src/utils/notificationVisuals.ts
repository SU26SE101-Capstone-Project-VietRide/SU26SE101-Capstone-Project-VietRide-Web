/**
 * Nhóm hiển thị của một thông báo — dùng để chọn icon trong hộp thư.
 *
 * Hộp thư trước đây là một dãy dòng chữ giống hệt nhau; khi nhà xe nhận cả
 * thông báo ví, chuyến, trung chuyển và sự cố trong cùng một danh sách thì không
 * lướt mắt phân biệt được. Icon là cách rẻ nhất để tách chúng ra.
 *
 * Phân loại theo CHUỖI CHỨA chứ không phải danh sách enum đóng: BE thêm loại mới
 * liên tục (`SHUTTLE_STARTED`, `SHUTTLE_REASSIGNED` là hai cái mới nhất) và một
 * union đóng ở FE nghĩa là mỗi lần BE thêm loại là hộp thư mất icon.
 */
export type NotificationVisualGroup =
  | "shuttle"
  | "trip"
  | "parcel"
  | "booking"
  | "wallet"
  | "subscription"
  | "incident"
  | "general";

export function getNotificationVisualGroup(
  notificationType: string | null | undefined,
): NotificationVisualGroup {
  const type = (notificationType ?? "").toUpperCase();

  if (!type) return "general";
  // Kiểm SHUTTLE trước TRIP: `SHUTTLE_TRIP_*` chứa cả hai từ, mà nó là thông
  // báo trung chuyển chứ không phải chuyến chính.
  if (type.includes("SHUTTLE")) return "shuttle";
  if (type.includes("INCIDENT")) return "incident";
  if (type.includes("PARCEL") || type.includes("CARGO")) return "parcel";
  if (type.includes("BOOKING") || type.includes("TICKET")) return "booking";
  if (type.includes("WALLET") || type.includes("PAYOUT")) return "wallet";
  if (
    type.includes("SUBSCRIPTION") ||
    type.includes("INVOICE") ||
    type.includes("BILLING")
  ) {
    return "subscription";
  }
  if (type.includes("TRIP")) return "trip";
  // `VEHICLE_SUBSTITUTION_*` không chứa "TRIP" nhưng là việc của chuyến chính.
  // Kiểm sau cùng vì "SUBSTITUTION" chỉ khác "SUBSCRIPTION" vài chữ — để trên
  // là nuốt nhầm nhóm gói cước.
  if (type.includes("SUBSTITUTION") || type.includes("VEHICLE")) return "trip";

  return "general";
}

/**
 * Màu nền/chữ của huy hiệu icon. Giữ cùng bảng màu `-50`/`-700` như `Badge` để
 * hộp thư không lạc tông so với phần còn lại của console.
 */
export const notificationGroupClasses: Record<NotificationVisualGroup, string> =
  {
    shuttle: "bg-vr-50 text-vr-900",
    trip: "bg-blue-50 text-blue-700",
    parcel: "bg-amber-50 text-amber-800",
    booking: "bg-teal-50 text-teal-800",
    wallet: "bg-emerald-50 text-emerald-800",
    subscription: "bg-purple-50 text-purple-700",
    incident: "bg-rose-50 text-rose-700",
    general: "bg-gray-100 text-gray-600",
  };
