import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorTrips,
  openOperatorTripBoarding,
  type OperatorTripListItem,
  type PagedResult,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import ToastProvider from "../../../components/toast/ToastProvider";
import TripListPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorTrips: vi.fn(),
  openOperatorTripBoarding: vi.fn(),
}));

function signInAs(role: string) {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresInSeconds: 3600,
      user: {
        id: "user-1",
        email: "admin@operator.vn",
        displayName: "Operator Admin",
        phone: "0900000000",
        role,
        operatorId: "operator-1",
      },
    }),
  );
}

function makePage(
  items: OperatorTripListItem[],
  totalItems = items.length,
): PagedResult<OperatorTripListItem> {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function makeTrip(
  overrides: Partial<OperatorTripListItem> = {},
): OperatorTripListItem {
  return {
    tripId: "6e4b0a1c-1111-2222-3333-444455556666",
    tripCode: "TRIP-20260816-001",
    status: "IN_PROGRESS",
    route: {
      routeId: "route-1",
      name: "HCM-CT",
      originName: "Bến xe Miền Tây",
      destinationName: "Bến xe Cần Thơ",
    },
    vehicle: { vehicleId: "vehicle-1", licensePlate: "51B-12345", status: "OK" },
    driver: {
      userId: "user-1",
      displayName: "Nguyễn Văn A",
      phone: "0900000000",
    },
    assistant: null,
    departureAt: "2026-08-16T08:00:00+07:00",
    arrivalEstimate: "2026-08-16T12:00:00+07:00",
    canSubstituteVehicle: true,
    ...overrides,
  };
}

function renderTripList() {
  return render(
    <ToastProvider>
      <TripListPage />
    </ToastProvider>,
  );
}

// Lượt tải danh sách (khác các lượt đếm cho thẻ số liệu, vốn chỉ có status + pageSize 1)
function listCalls() {
  return vi
    .mocked(getOperatorTrips)
    .mock.calls.filter(([params]) => params?.pageSize === 10);
}

describe("Manager trip list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getOperatorTrips).mockImplementation(async (params = {}) => {
      // Ba lượt đếm cho thẻ số liệu dùng pageSize = 1, chỉ cần totalItems
      if (params.pageSize === 1) return makePage([], 7);
      return makePage([makeTrip()], 1);
    });
  });

  it("liệt kê chuyến của nhà xe và xin trang đầu theo giờ khởi hành giảm dần", async () => {
    renderTripList();

    expect(await screen.findByText("HCM-CT")).toBeInTheDocument();
    expect(screen.getByText("51B-12345")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(
      screen.getByText("tripList.statuses.IN_PROGRESS", {
        selector: "span.rounded-full",
      }),
    ).toBeInTheDocument();

    expect(listCalls()[0][0]).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: "departureAt",
      sortDir: "desc",
    });
  });

  // Trước đây cột "Mã chuyến" hiện 8 ký tự đầu của UUID viết hoa khi BE không
  // trả `tripCode` — trông như mã nghiệp vụ nhưng tra cứu ở đâu cũng không ra.
  // Cột đã bỏ; không được để lỗi này quay lại dưới dạng khác.
  it("không dựng mã chuyến từ tripId", async () => {
    vi.mocked(getOperatorTrips).mockImplementation(async (params = {}) => {
      if (params.pageSize === 1) return makePage([], 0);
      return makePage([makeTrip({ tripCode: undefined })], 1);
    });

    renderTripList();

    await screen.findByText("HCM-CT");
    expect(screen.queryByText("6E4B0A1C")).not.toBeInTheDocument();
  });

  it("đẩy từ khoá vào query `search` sau debounce", async () => {
    const user = userEvent.setup();
    renderTripList();
    await screen.findByText("HCM-CT");

    await user.type(screen.getByLabelText("tripList.searchLabel"), "51B-12345");

    await waitFor(() => {
      expect(listCalls().at(-1)?.[0]).toMatchObject({ search: "51B-12345" });
    });
  });

  it("gửi khoảng ngày lọc lên BE qua `from`", async () => {
    const user = userEvent.setup();
    renderTripList();
    await screen.findByText("HCM-CT");

    // CustomDateTimeInput mở lịch ở tháng hiện tại; chọn ngày 15 của chính tháng
    // đó để test không phụ thuộc vào ngày chạy máy.
    const today = new Date();
    const target = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-15`;

    await user.click(screen.getByRole("button", { name: "tripList.fromLabel" }));
    await user.click(await screen.findByRole("button", { name: target }));

    await waitFor(() => {
      expect(listCalls().at(-1)?.[0]).toMatchObject({ from: target });
    });
  });

  it("báo lỗi qua toast và để bảng trống khi API hỏng", async () => {
    vi.mocked(getOperatorTrips).mockRejectedValue(
      new Error("Không thể tải danh sách chuyến."),
    );

    renderTripList();

    expect(
      await screen.findByText("Không thể tải danh sách chuyến."),
    ).toBeInTheDocument();
    expect(screen.getByText("tripList.empty")).toBeInTheDocument();
  });

  // Handoff Manual boarding §10. Chuyến SCHEDULED chỉ có ở màn này — Trung tâm
  // vận hành chỉ tải IN_PROGRESS/DISRUPTED nên nút đặt ở đó không bao giờ hiện.
  describe("mở boarding thủ công", () => {
    beforeEach(() => {
      signInAs("OPERATOR_ADMIN");
      vi.mocked(getOperatorTrips).mockImplementation(async (params = {}) => {
        if (params.pageSize === 1) return makePage([], 1);
        return makePage([makeTrip({ status: "SCHEDULED" })], 1);
      });
      vi.mocked(openOperatorTripBoarding).mockResolvedValue({
        tripId: makeTrip().tripId,
        status: "BOARDING",
      });
    });

    async function confirmBoarding(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        await screen.findByRole("button", { name: "tripList.boarding" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));
    }

    function boardingKeyOfCall(call: number) {
      return vi.mocked(openOperatorTripBoarding).mock.calls[call][1];
    }

    it("gọi API kèm idempotency key rồi tải lại danh sách", async () => {
      const user = userEvent.setup();
      renderTripList();

      await confirmBoarding(user);

      expect(openOperatorTripBoarding).toHaveBeenCalledWith(
        makeTrip().tripId,
        expect.any(String),
      );
      expect(boardingKeyOfCall(0)).toBeTruthy();
      // Trạng thái mới lấy lại từ BE, không ép local (§11)
      await waitFor(() => expect(listCalls().length).toBeGreaterThan(1));
    });

    it("ẩn cột thao tác với OPERATOR_STAFF", async () => {
      signInAs("OPERATOR_STAFF");
      renderTripList();

      await screen.findByText("HCM-CT");
      expect(
        screen.queryByRole("button", { name: "tripList.boarding" }),
      ).not.toBeInTheDocument();
    });

    it("không hiện nút cho chuyến đã rời SCHEDULED", async () => {
      vi.mocked(getOperatorTrips).mockImplementation(async (params = {}) => {
        if (params.pageSize === 1) return makePage([], 1);
        return makePage([makeTrip({ status: "BOARDING" })], 1);
      });
      renderTripList();

      await screen.findByText("HCM-CT");
      expect(
        screen.queryByRole("button", { name: "tripList.boarding" }),
      ).not.toBeInTheDocument();
    });

    // §8: chưa biết BE đã xử lý hay chưa thì phải retry đúng key cũ.
    it("giữ nguyên key khi retry sau lỗi 5xx", async () => {
      const user = userEvent.setup();
      vi.mocked(openOperatorTripBoarding).mockRejectedValueOnce(
        new ApiRequestError("Upstream error", 502, "UPSTREAM_UNAVAILABLE"),
      );
      renderTripList();

      await confirmBoarding(user);
      await confirmBoarding(user);

      expect(openOperatorTripBoarding).toHaveBeenCalledTimes(2);
      expect(boardingKeyOfCall(1)).toBe(boardingKeyOfCall(0));
    });

    // §8: lỗi nghiệp vụ được BE cache 24h — key cũ chỉ replay đúng lỗi đó.
    it("sinh key mới sau khi bị từ chối vì chưa tới cửa sổ boarding", async () => {
      const user = userEvent.setup();
      vi.mocked(openOperatorTripBoarding).mockRejectedValueOnce(
        new ApiRequestError("Too early", 409, "TRIP_BOARDING_TOO_EARLY"),
      );
      renderTripList();

      await confirmBoarding(user);
      await confirmBoarding(user);

      expect(openOperatorTripBoarding).toHaveBeenCalledTimes(2);
      expect(boardingKeyOfCall(1)).not.toBe(boardingKeyOfCall(0));
    });

    // §11: chuyến bị huỷ giữa chừng thì hàng đang hiển thị đã cũ — phải tải lại
    // thay vì ép trạng thái ở FE.
    it("tải lại danh sách khi BE báo trạng thái không còn hợp lệ", async () => {
      const user = userEvent.setup();
      vi.mocked(openOperatorTripBoarding).mockRejectedValueOnce(
        new ApiRequestError("Invalid transition", 409, "TRIP_INVALID_TRANSITION"),
      );
      renderTripList();

      const callsBefore = listCalls().length;
      await confirmBoarding(user);

      await waitFor(() =>
        expect(listCalls().length).toBeGreaterThan(callsBefore),
      );
    });
  });
});
