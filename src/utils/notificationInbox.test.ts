import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/vietride", () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

import { getNotifications, markNotificationRead } from "../api/vietride";
import { markAllNotificationsRead } from "./notificationInbox";

function unreadPage(ids: string[], page: number, totalPages: number) {
  return {
    items: ids.map((id) => ({
      id,
      type: "PARCEL",
      title: "t",
      body: "b",
      data: null,
      readAt: null,
      createdAt: "2026-08-22T10:00:00Z",
    })),
    page,
    pageSize: 100,
    totalItems: 0,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

describe("markAllNotificationsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markNotificationRead).mockResolvedValue(null);
  });

  it("marks every unread notification across all pages", async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce(unreadPage(["a", "b"], 1, 2))
      .mockResolvedValueOnce(unreadPage(["c"], 2, 2));

    const result = await markAllNotificationsRead();

    expect(result).toEqual({ marked: 3, failed: 0, hasMore: false });
    expect(markNotificationRead).toHaveBeenCalledTimes(3);
    expect(markNotificationRead).toHaveBeenCalledWith("c");
  });

  it("asks the backend for the largest page it allows", async () => {
    vi.mocked(getNotifications).mockResolvedValue(unreadPage([], 1, 1));

    await markAllNotificationsRead();

    // pageSize trần của BE là 100 — lấy tối đa để gọi danh sách ít lần nhất
    expect(getNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ unreadOnly: true, pageSize: 100 }),
    );
  });

  it("collects every id before marking any of them", async () => {
    // Vừa lấy vừa đánh dấu thì trang 2 bị lệch: cái vừa đọc rơi khỏi tập unread
    // và đẩy phần còn lại dịch lên. Nên phải gom xong mới bắn.
    const callOrder: string[] = [];
    vi.mocked(getNotifications).mockImplementation(async (params) => {
      callOrder.push(`list:${params?.page}`);
      return params?.page === 1
        ? unreadPage(["a"], 1, 2)
        : unreadPage(["b"], 2, 2);
    });
    vi.mocked(markNotificationRead).mockImplementation(async (id) => {
      callOrder.push(`mark:${id}`);
      return null;
    });

    await markAllNotificationsRead();

    expect(callOrder).toEqual(["list:1", "list:2", "mark:a", "mark:b"]);
  });

  it("counts failures instead of aborting the whole run", async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      unreadPage(["a", "b", "c"], 1, 1),
    );
    vi.mocked(markNotificationRead).mockImplementation(async (id) => {
      if (id === "b") throw new Error("boom");
      return null;
    });

    // Đánh dấu được 2/3 vẫn là tiến bộ — không ném lỗi, trả số liệu để nơi gọi
    // tự quyết báo gì
    await expect(markAllNotificationsRead()).resolves.toEqual({
      marked: 2,
      failed: 1,
      hasMore: false,
    });
  });

  it("stops instead of looping when the backend returns an empty page", async () => {
    // totalPages nói còn trang nhưng trang trả về rỗng (dữ liệu vừa đổi) —
    // không có nhánh dừng này là lặp vô hạn
    vi.mocked(getNotifications).mockResolvedValue(unreadPage([], 1, 5));

    const result = await markAllNotificationsRead();

    expect(result.marked).toBe(0);
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it("caps one run and reports that more are left", async () => {
    const manyIds = Array.from({ length: 100 }, (_, index) => `id-${index}`);
    // 6 trang × 100 = 600 > trần 500 của một lượt
    vi.mocked(getNotifications).mockImplementation(async (params) =>
      unreadPage(manyIds, params?.page ?? 1, 6),
    );

    const result = await markAllNotificationsRead();

    expect(result.marked).toBe(500);
    expect(result.hasMore).toBe(true);
  });
});
