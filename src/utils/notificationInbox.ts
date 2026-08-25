import { getNotifications, markNotificationRead } from "../api/vietride";

// Đánh dấu ĐÃ ĐỌC toàn bộ thông báo chưa đọc của user hiện tại.
//
// GIẢI PHÁP TẠM: BE chưa có endpoint đọc-tất-cả. `API-Notification.md` liệt kê
// đúng bốn endpoint và chỉ có `POST /v1/notifications/:id/read` cho từng cái —
// nên FE phải tự gom: lấy hết id chưa đọc rồi bắn lần lượt.
//
// Đúng ra BE nên có `POST /v1/notifications/read-all`: một câu UPDATE, nguyên
// tử, một request thay vì N. Xoá file này khi endpoint đó có.

// Trần `pageSize` của BE (API-Notification.md §3: max 100) — lấy tối đa mỗi lượt
// để số lần gọi danh sách ít nhất có thể.
const UNREAD_PAGE_SIZE = 100;

// Bắn theo lô thay vì đồng loạt: N có thể lên hàng trăm, mở ngần đó kết nối một
// lúc là tự làm nghẽn chính mình (và trình duyệt cũng xếp hàng lại thôi).
const MARK_BATCH_SIZE = 6;

// Chặn trường hợp bệnh lý (hộp thư bỏ quên hàng nghìn thông báo): đọc tới đây
// rồi dừng, lần bấm sau xử lý tiếp. Thà làm nhiều nhịp còn hơn treo trình duyệt.
const MAX_MARK_PER_RUN = 500;

export type MarkAllNotificationsResult = {
  marked: number;
  failed: number;
  // true = còn thông báo chưa đọc vượt trần của lượt này, bấm lần nữa để tiếp
  hasMore: boolean;
};

// Gom id của mọi thông báo chưa đọc TRƯỚC khi đánh dấu. Vừa lấy vừa đánh dấu
// thì trang sau bị lệch: mỗi cái vừa đọc rơi khỏi tập unread, đẩy phần còn lại
// dịch lên và làm sót.
async function collectUnreadIds() {
  const ids: string[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && ids.length < MAX_MARK_PER_RUN) {
    const result = await getNotifications({
      unreadOnly: true,
      page,
      pageSize: UNREAD_PAGE_SIZE,
      sortBy: "createdAt",
      sortDir: "desc",
    });

    totalPages = result.totalPages;
    result.items.forEach((item) => {
      if (ids.length < MAX_MARK_PER_RUN) ids.push(item.id);
    });

    // BE trả trang rỗng giữa chừng (dữ liệu vừa đổi) → dừng, đừng lặp vô hạn
    if (result.items.length === 0) break;
    page += 1;
  }

  return { ids, hasMore: ids.length >= MAX_MARK_PER_RUN };
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsResult> {
  const { ids, hasMore } = await collectUnreadIds();
  let marked = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += MARK_BATCH_SIZE) {
    const batch = ids.slice(index, index + MARK_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => markNotificationRead(id)),
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") marked += 1;
      else failed += 1;
    });
  }

  // Không ném lỗi khi lẻ tẻ vài cái hỏng: đánh dấu được 60/67 vẫn là tiến bộ,
  // nơi gọi tự quyết báo gì cho người dùng dựa trên `failed`.
  return { marked, failed, hasMore };
}
