import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  OperatorShuttleContext,
  OperatorShuttleTripListItem,
  ShuttleDirection,
} from "../../../api/vietride";
import ShuttleTripDetailModal from "./ShuttleTripDetailModal";

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

// Phần danh sách khách gọi API riêng — không thuộc phạm vi test này
vi.mock("./ShuttleTripPassengersSection", () => ({
  default: () => null,
}));

function buildTrip(
  direction: ShuttleDirection,
): OperatorShuttleTripListItem {
  return {
    shuttleTripId: "shuttle-1",
    mainTripId: "trip-1",
    direction,
    status: "COMPLETED",
    scheduledDepartureTime: "2026-08-27T08:45:00Z",
    scheduledEndTime: "2026-08-27T08:50:00Z",
    actualDepartureTime: "2026-08-27T08:45:00Z",
    completedAt: "2026-08-27T08:47:00Z",
    vehicle: { id: "v-1", licensePlate: "30F-170.10" },
    driver: { id: "d-1", displayName: "Tài xế A", phone: "0909888777" },
    passengerCount: 2,
    stopCount: 3,
  };
}

// Hai khách đã trả xong, và bến đứng cuối lộ trình
const context: OperatorShuttleContext = {
  shuttleTripId: "shuttle-1",
  stops: [
    {
      pickupOrder: 1,
      bookingId: "booking-1",
      latitude: 10.8,
      longitude: 106.63,
      status: "DELIVERED",
      isStation: false,
      serviceAddress: "Galaxy Cinema, 246A Nguyễn Hồng Đào",
    },
    {
      pickupOrder: 2,
      bookingId: "booking-2",
      latitude: 10.75,
      longitude: 106.62,
      status: "DELIVERED",
      isStation: false,
      serviceAddress: "Kinh Dương Vương, An Lạc",
    },
    // Bến: KHÔNG có booking nào, nên `status` mặc định của BE vô nghĩa ở đây
    {
      pickupOrder: 3,
      bookingId: null,
      latitude: 10.74,
      longitude: 106.62,
      status: "PENDING",
      isStation: true,
    },
  ],
  station: {
    stationId: "st-1",
    name: "Bến xe Miền Tây",
    latitude: 10.74,
    longitude: 106.62,
    pickupOrder: 3,
  },
} as OperatorShuttleContext;

function renderModal(direction: ShuttleDirection = "INBOUND_TO_STATION") {
  render(
    <ShuttleTripDetailModal
      open
      onClose={vi.fn()}
      trip={buildTrip(direction)}
      context={context}
      directionLabel={(value) => `dispatch.direction.${value}`}
      isLoading={false}
      error=""
      canUnassignBooking
      onBookingMutationSettled={vi.fn()}
    />,
  );
}

describe("ShuttleTripDetailModal — hàng bến trong lộ trình", () => {
  // Bến không phải một điểm đón: `bookingId` null nên `status` (trạng thái
  // đón/trả của MỘT khách) không áp dụng được. Dán nguyên `PENDING` vào thì bến
  // hiện "Chờ đón" ngay cả khi mọi khách đã trả xong — tự mâu thuẫn.
  it("không gắn trạng thái đón/trả của khách lên hàng bến", () => {
    renderModal();

    // Hai khách đã trả vẫn hiện trạng thái của chúng
    expect(
      screen.getAllByText("dispatch.stopStatus.DELIVERED"),
    ).toHaveLength(2);
    // Còn bến thì không được mang trạng thái "chờ đón" nào
    expect(
      screen.queryByText("dispatch.stopStatus.PENDING"),
    ).not.toBeInTheDocument();
  });

  it("nêu VAI TRÒ của bến theo chiều chạy — đón khách về bến thì bến là nơi trả", () => {
    renderModal("INBOUND_TO_STATION");

    expect(
      screen.getByText("dispatch.stationRole.INBOUND_TO_STATION"),
    ).toBeInTheDocument();
  });

  it("đảo vai trò khi chuyến chạy chiều ngược lại", () => {
    renderModal("OUTBOUND_FROM_STATION");

    expect(
      screen.getByText("dispatch.stationRole.OUTBOUND_FROM_STATION"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("dispatch.stationRole.INBOUND_TO_STATION"),
    ).not.toBeInTheDocument();
  });

  it("vẫn liệt kê bến trong lộ trình — nó là chặng cuối xe thật sự chạy tới", () => {
    renderModal();

    // Tên bến hiện ở cả ô tóm tắt lẫn hàng cuối lộ trình
    expect(screen.getAllByText("Bến xe Miền Tây").length).toBeGreaterThan(1);
  });
});
