import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import SharedTripDetailsPanel from "./SharedTripDetailsPanel";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

const context: SharedTripContext = {
  status: "IN_PROGRESS",
  expiresAt: "2026-08-31T12:00:00+07:00",
  lastUpdatedAt: "2026-08-31T09:30:00+07:00",
  vehicle: { location: null },
  route: {
    originName: "Bến xe Miền Đông",
    destinationName: "Bến xe Vũng Tàu",
    origin: { latitude: 10.8231, longitude: 106.6297 },
    destination: { latitude: 10.346, longitude: 107.0843 },
    geometry: null,
    stops: [
      {
        name: "Trạm Long Thành",
        latitude: 10.7412,
        longitude: 106.9534,
        sequence: 1,
      },
    ],
  },
  eta: {
    remainingSeconds: 900,
    estimatedArrivalAt: "2026-08-31T09:45:00+07:00",
    delayMinutes: 0,
    updatedAt: "2026-08-31T09:30:00+07:00",
  },
};

const location: SharedTripVehicleLocation = {
  latitude: 10.75,
  longitude: 106.85,
  speedKph: 48,
  heading: 120,
  recordedAt: "2026-08-31T09:31:00+07:00",
};

describe("SharedTripDetailsPanel", () => {
  let originalLanguage: string;

  beforeAll(async () => {
    originalLanguage = i18n.language;
    await i18n.changeLanguage("vi");
  });

  afterAll(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("shows the mobile-style live metrics, route and privacy information", () => {
    render(
      <SharedTripDetailsPanel
        context={context}
        latestUpdate={location.recordedAt}
        locale="vi-VN"
        location={location}
        revokedCopy={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Chuyến xe đang chia sẻ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Còn ~15 phút")).toBeInTheDocument();
    expect(screen.getByText("48 km/h")).toBeInTheDocument();
    expect(screen.getByText("Bến xe Miền Đông")).toBeInTheDocument();
    expect(screen.getByText("Bến xe Vũng Tàu")).toBeInTheDocument();
    expect(screen.getByText("Không yêu cầu tài khoản VietRide")).toBeInTheDocument();
  });

  it("keeps intermediate stops in a keyboard-accessible disclosure", () => {
    render(
      <SharedTripDetailsPanel
        context={context}
        latestUpdate={location.recordedAt}
        locale="vi-VN"
        location={location}
        revokedCopy={null}
      />,
    );

    const summary = screen.getByText("1 điểm dừng trên tuyến").closest("summary");
    const details = summary?.closest("details");
    expect(summary).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary!);

    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Trạm Long Thành")).toBeInTheDocument();
  });

  it("hides ETA while waiting for the replacement vehicle GPS", () => {
    render(
      <SharedTripDetailsPanel
        context={{
          ...context,
          status: "VEHICLE_REPLACEMENT_PENDING",
        }}
        latestUpdate={location.recordedAt}
        locale="vi-VN"
        location={location}
        revokedCopy={null}
      />,
    );

    expect(screen.queryByText("Dự kiến đến")).not.toBeInTheDocument();
    expect(screen.queryByText("Còn ~15 phút")).not.toBeInTheDocument();
    expect(screen.getAllByText("Đang đổi xe").length).toBeGreaterThan(0);
  });
});
