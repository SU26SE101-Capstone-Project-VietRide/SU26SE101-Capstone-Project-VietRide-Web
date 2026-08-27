import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScheduleTable from "./ScheduleTable";
import type { RouteOption, TripSchedule, VehicleOption } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const schedule: TripSchedule = {
  id: "schedule-1",
  status: "open",
  routeId: "route-1",
  routeName: "Hồ Chí Minh - Đà Lạt",
  vehicleId: "vehicle-1",
  vehiclePlate: "51B-123.45",
  driverId: "driver-1",
  assistantId: "",
  departureAt: "2026-09-01T08:00",
  arrivalEstimate: "2026-09-01T15:00",
  validUntil: "2026-09-01",
  baseFare: "",
  isOneTime: true,
  dayOfWeek: [2],
};

const vehicle: VehicleOption = {
  id: "vehicle-1",
  plate: "51B-123.45",
  vehicleType: "SLEEPER",
  seats: 40,
  status: "active",
};

function renderTable(routes: RouteOption[]) {
  return render(
    <ScheduleTable
      schedules={[schedule]}
      routes={routes}
      vehicles={[vehicle]}
      canManageSchedules={false}
      isLoading={false}
      page={1}
      pageSize={10}
      onPageChange={vi.fn()}
      onEdit={vi.fn()}
      onChangeCrew={vi.fn()}
      onToggleActive={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("ScheduleTable", () => {
  // Cột Phân công rộng cố định nên dòng "biển số · loại xe" hay bị cắt giữa
  // chừng — `title` cho xem đủ khi rê chuột.
  it("gắn title đầy đủ cho hai dòng của cột Phân công", () => {
    renderTable([
      {
        id: "route-1",
        name: "Hồ Chí Minh - Đà Lạt",
        origin: "Hồ Chí Minh",
        destination: "Đà Lạt",
        status: "active",
        baseFare: 250_000,
      },
    ]);

    // Tài xế: schedule không có driverName và danh sách drivers rỗng → fallback
    expect(screen.getByText("vehicles.unassigned")).toHaveAttribute(
      "title",
      "vehicles.unassigned",
    );

    const vehicleLine = "51B-123.45 · SLEEPER";
    expect(screen.getByText(vehicleLine)).toHaveAttribute("title", vehicleLine);
  });

  it("shows the route fare when the schedule has no custom fare", () => {
    renderTable([
      {
        id: "route-1",
        name: "Hồ Chí Minh - Đà Lạt",
        origin: "Hồ Chí Minh",
        destination: "Đà Lạt",
        status: "active",
        baseFare: 250_000,
      },
    ]);

    expect(screen.getByText("250.000 đ")).toBeInTheDocument();
    expect(screen.queryByText("trips.routeFareFallback")).not.toBeInTheDocument();
  });

  it("keeps the route-fare fallback when the route has no configured fare", () => {
    renderTable([
      {
        id: "route-1",
        name: "Hồ Chí Minh - Đà Lạt",
        origin: "Hồ Chí Minh",
        destination: "Đà Lạt",
        status: "active",
      },
    ]);

    expect(screen.getByText("trips.routeFareFallback")).toBeInTheDocument();
  });
});
