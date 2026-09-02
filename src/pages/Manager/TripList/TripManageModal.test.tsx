import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  cancelOperatorTrip,
  getOperatorTripCargoCapacity,
  getOperatorIncidents,
  getOperatorRoutes,
  getOperatorVehicles,
  previewOperatorTripCancel,
  updateOperatorTrip,
  type OperatorIncident,
  type OperatorTripListItem,
} from "../../../api/vietride";
import TripManageModal from "./TripManageModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const entries = Object.entries(vars ?? {}).filter(
        ([name]) => name !== "defaultValue",
      );
      return entries.length === 0
        ? key
        : `${key} ${entries.map(([name, value]) => `${name}=${value}`).join(" ")}`;
    },
  }),
}));

vi.mock("../../../api/vietride", () => ({
  cancelOperatorTrip: vi.fn(),
  getOperatorTripCargoCapacity: vi.fn(),
  getOperatorIncidents: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorVehicles: vi.fn(),
  previewOperatorTripCancel: vi.fn(),
  updateOperatorTrip: vi.fn(),
  getPublicTripSeatMap: vi.fn(),
  disableOperatorTripSeat: vi.fn(),
  enableOperatorTripSeat: vi.fn(),
}));

const trip: OperatorTripListItem = {
  tripId: "trip-1",
  tripCode: "TRIP-20260826-ABCD1234",
  status: "SCHEDULED",
  route: {
    routeId: "route-1",
    code: "SG-DL-01",
    name: "Sài Gòn - Đà Lạt",
    originName: "Sài Gòn",
    destinationName: "Đà Lạt",
  },
  vehicle: {
    vehicleId: "vehicle-1",
    licensePlate: "51B-123.45",
    status: "ACTIVE",
  },
  driver: null,
  assistant: null,
  departureAt: "2026-08-27T07:00:00+07:00",
  arrivalEstimate: null,
  canSubstituteVehicle: true,
};

function emptyPage() {
  return {
    items: [],
    page: 1,
    pageSize: 100,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function renderModal(
  overrides: Partial<OperatorTripListItem> = {},
  canMutate = true,
) {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    // Khối sự cố có link sang màn Báo cáo sự cố nên modal cần router context.
    <MemoryRouter>
      <TripManageModal
        trip={{ ...trip, ...overrides }}
        canMutate={canMutate}
        onClose={onClose}
        onChanged={onChanged}
      />
    </MemoryRouter>,
  );
  return { onChanged, onClose };
}

describe("TripManageModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorVehicles).mockResolvedValue(emptyPage() as never);
    vi.mocked(getOperatorRoutes).mockResolvedValue(emptyPage() as never);
    vi.mocked(previewOperatorTripCancel).mockResolvedValue({
      tripId: "trip-1",
      affectedBookingIds: ["booking-1", "booking-2"],
      affectedParcelIds: ["parcel-1"],
      refundTotalBooking: 800000,
      refundTotalParcel: 150000,
      grandTotal: 950000,
    });
    vi.mocked(updateOperatorTrip).mockResolvedValue({ tripId: "trip-1" });
    vi.mocked(cancelOperatorTrip).mockResolvedValue({
      tripId: "trip-1",
      status: "CANCELLED",
    });
    vi.mocked(getOperatorIncidents).mockResolvedValue(emptyPage() as never);
    vi.mocked(getOperatorTripCargoCapacity).mockResolvedValue({
      tripId: "trip-1",
      reservedWeightKg: 300,
      reservedVolumeM3: 2.5,
      loadedWeightKg: 200,
      loadedVolumeM3: 1.5,
      maxCargoWeightKg: 1_000,
      maxCargoVolumeM3: 8,
      availableWeightKg: 500,
      availableVolumeM3: 4,
      percentFull: 20,
    });
  });

  // BE nhận partial: gửi cả form là tự ghi đè những giá trị mình chưa từng nhìn.
  it("chỉ gửi field đã sửa khi lưu", async () => {
    const user = userEvent.setup();
    const { onChanged } = renderModal();

    await user.type(
      screen.getByLabelText("tripList.manage.baseFare"),
      "250000",
    );
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() =>
      expect(updateOperatorTrip).toHaveBeenCalledWith("trip-1", {
        baseFare: 250000,
      }),
    );
    expect(onChanged).toHaveBeenCalledWith("tripList.manage.saveSuccess");
  });

  it("khoá nút Lưu khi chưa sửa gì", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });

  // Ô giá để trống nghĩa là bỏ giá riêng của chuyến, quay về giá gốc của tuyến
  // — phải gửi `null` chứ không phải `0` hay bỏ qua field.
  it("gửi null khi xoá trắng ô giá vé đã có giá trị", async () => {
    const user = userEvent.setup();
    renderModal();

    const fare = screen.getByLabelText("tripList.manage.baseFare");
    await user.type(fare, "250000");
    await user.clear(fare);
    await user.type(screen.getByLabelText("tripList.manage.notes"), "Xe mới");
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() =>
      expect(updateOperatorTrip).toHaveBeenCalledWith("trip-1", {
        notes: "Xe mới",
      }),
    );
  });

  it("hiển thị tài xế và phụ xe trong phần thông tin chuyến", () => {
    renderModal({
      driver: {
        userId: "driver-1",
        displayName: "Nguyễn Văn A",
        phone: "0901234567",
      },
      assistant: {
        userId: "assistant-1",
        displayName: "Trần Thị B",
        phone: "0907654321",
      },
    });

    expect(screen.getByText("tripList.manage.driver")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("tripList.manage.assistant")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị B")).toBeInTheDocument();
  });

  it("tự tải và hiển thị sức chứa hàng hóa của chuyến", async () => {
    renderModal();

    expect(getOperatorTripCargoCapacity).toHaveBeenCalledWith("trip-1");
    expect(await screen.findByText("1.000 kg")).toBeInTheDocument();
    expect(screen.getByText("8 m³")).toBeInTheDocument();
    expect(screen.getByText("500 kg · 4 m³")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("cho phép tải lại khi không lấy được sức chứa", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorTripCargoCapacity)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        tripId: "trip-1",
        maxCargoWeightKg: 750,
        maxCargoVolumeM3: 6,
      });

    renderModal();

    expect(
      await screen.findByText("tripList.manage.cargoFailed"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));

    expect(await screen.findByText("750 kg")).toBeInTheDocument();
    expect(getOperatorTripCargoCapacity).toHaveBeenCalledTimes(2);
  });

  it("chuyến đã chạy thì khoá form và ẩn mục huỷ chuyến", () => {
    renderModal({ status: "IN_PROGRESS" });

    expect(screen.getByLabelText("tripList.manage.baseFare")).toBeDisabled();
    expect(
      screen.getByText("tripList.manage.detailsLocked"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("tripList.manage.cancelTitle"),
    ).not.toBeInTheDocument();
  });

  it("OPERATOR_STAFF chỉ xem, không sửa và không huỷ được", () => {
    renderModal({}, false);

    expect(screen.getByLabelText("tripList.manage.baseFare")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("tripList.manage.cancelTitle"),
    ).not.toBeInTheDocument();
  });

  // Nút huỷ chỉ xuất hiện SAU khi đã xem trước: huỷ chuyến hoàn tiền cho toàn bộ
  // vé và đơn hàng, không được để bấm nhầm khi chưa biết thiệt hại.
  it("phải xem trước thiệt hại rồi mới huỷ được", async () => {
    const user = userEvent.setup();
    const { onChanged } = renderModal();

    expect(
      screen.queryByRole("button", { name: "tripList.manage.cancelAction" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "tripList.manage.previewAction" }),
    );

    expect(await screen.findByText("950.000 đ")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("tripList.manage.cancelReason"),
      "Xe hỏng",
    );
    await user.click(
      screen.getByRole("button", { name: "tripList.manage.cancelAction" }),
    );
    // Bước xác nhận thứ hai — thao tác không hoàn tác được. Lúc này có HAI nút
    // cùng nhãn (nút trong mục huỷ và nút trong hộp xác nhận); hộp xác nhận
    // render sau qua portal nên là nút cuối.
    const confirmButtons = await screen.findAllByRole("button", {
      name: "tripList.manage.cancelAction",
    });
    expect(confirmButtons).toHaveLength(2);
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(cancelOperatorTrip).toHaveBeenCalledWith(
        "trip-1",
        "Xe hỏng",
        expect.any(String),
      ),
    );
    expect(onChanged).toHaveBeenCalledWith("tripList.manage.cancelSuccess");
  });

  it("lỗi lưu thì hiện thông báo và không đóng modal", async () => {
    const user = userEvent.setup();
    vi.mocked(updateOperatorTrip).mockRejectedValue(
      new Error("Chuyến đi này hiện không thể chỉnh sửa."),
    );
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText("tripList.manage.baseFare"), "1000");
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(
      await screen.findByText("Chuyến đi này hiện không thể chỉnh sửa."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
  // `GET /v1/operator/trips` không trả lý do gián đoạn ở bất kỳ field nào, nên
  // màn chỉ in được badge "Gặp sự cố". Lý do phải lấy từ danh sách sự cố của
  // ĐÚNG chuyến đó.
  it("hiện lý do sự cố của chuyến DISRUPTED", async () => {
    const incident: OperatorIncident = {
      incidentId: "incident-1",
      category: "VEHICLE_BREAKDOWN",
      description: "Xe nổ lốp trên quốc lộ 1A",
      photoUrls: null,
      latitude: null,
      longitude: null,
      reportedAt: "2026-08-30T16:20:00+07:00",
      status: "OPEN",
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
      trip: {
        tripId: "trip-1",
        status: "DISRUPTED",
        departureDateTime: "2026-08-30T16:00:00+07:00",
        route: {
          routeId: "route-1",
          name: "Sài Gòn - Đà Lạt",
          originStation: { stationId: "s1", name: "Bến xe Miền Tây" },
          destinationStation: { stationId: "s2", name: "Bến xe Đồng Nai" },
        },
      },
      reporter: { userId: "user-1", displayName: "Bùi Văn Hùng", role: "DRIVER" },
    };
    vi.mocked(getOperatorIncidents).mockResolvedValue({
      ...emptyPage(),
      items: [incident],
      totalItems: 1,
      totalPages: 1,
    } as never);

    renderModal({ status: "DISRUPTED" });

    expect(
      await screen.findByText("Xe nổ lốp trên quốc lộ 1A"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("incidents.categories.VEHICLE_BREAKDOWN"),
    ).toBeInTheDocument();
    expect(getOperatorIncidents).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1" }),
    );
  });

  // Chuyến bình thường không được bắn thêm request nào: đại đa số chuyến không
  // có sự cố, tải sẵn cho tất cả là lãng phí một request mỗi lần mở modal.
  it("không hỏi sự cố khi chuyến không ở trạng thái DISRUPTED", () => {
    renderModal();

    expect(getOperatorIncidents).not.toHaveBeenCalled();
  });

  // Tải hỏng KHÁC "chưa có sự cố nào" — hai câu đó dẫn người vận hành đi hai
  // hướng khác nhau nên không được gộp làm một.
  it("phân biệt tải sự cố hỏng với chuyến chưa có sự cố", async () => {
    vi.mocked(getOperatorIncidents).mockRejectedValue(new Error("network"));

    renderModal({ status: "DISRUPTED" });

    expect(
      await screen.findByText("tripList.manage.incidentsFailed"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("tripList.manage.noIncident"),
    ).not.toBeInTheDocument();
  });
});
