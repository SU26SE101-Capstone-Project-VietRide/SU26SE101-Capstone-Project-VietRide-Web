import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorStations,
  recordParcelStationHandoff,
} from "../../../api/vietride";
import StationHandoffModal from "./StationHandoffModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    getOperatorStations: vi.fn(),
    recordParcelStationHandoff: vi.fn(),
  };
});

const stationsMock = vi.mocked(getOperatorStations);
const handoffMock = vi.mocked(recordParcelStationHandoff);
const onRecorded = vi.fn();

function station(id: string, name: string, override: string | null) {
  return {
    id: `op-${id}`,
    stationId: id,
    displayNameOverride: override,
    station: {
      id,
      name,
      city: "TP.HCM",
      latitude: 10.8,
      longitude: 106.7,
    },
  };
}

const stations = [
  station("36000000-0000-4000-8000-000000000501", "Bến B", "Kho bến B"),
  station("36000000-0000-4000-8000-000000000502", "Bến C", null),
] as Awaited<ReturnType<typeof getOperatorStations>>["items"];

function renderModal() {
  return render(
    <StationHandoffModal
      open
      parcelId="parcel-1"
      parcelCode="VR-PCL-20260824-ABCD2345"
      onClose={vi.fn()}
      onRecorded={onRecorded}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stationsMock.mockResolvedValue({
    items: stations,
    page: 1,
    pageSize: 100,
    totalItems: stations.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
});

describe("StationHandoffModal", () => {
  // Trước đây ô này bắt gõ tay UUID — nhân viên trực kho không thuộc UUID nào.
  it("cho chọn bến từ danh sách thay vì gõ mã", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByLabelText("parcels.handoff.stationLabel"));

    expect(await screen.findByRole("option", { name: "Kho bến B" })).toBeTruthy();
    // Không có tên riêng thì lùi về tên bến gốc
    expect(screen.getByRole("option", { name: "Bến C" })).toBeTruthy();
  });

  // BE không tra tên từ mã vị trí, nó chỉ lưu nguyên `locationSnapshot`. Điền
  // sẵn để màn Sự cố không hiện một dòng trống.
  it("điền sẵn chỗ cất theo tên bến vừa chọn", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByLabelText("parcels.handoff.stationLabel"));
    await user.click(screen.getByRole("option", { name: "Kho bến B" }));

    expect(
      screen.getByLabelText("parcels.handoff.locationSnapshotLabel"),
    ).toHaveValue("Kho bến B");
  });

  it("không đè lên chỗ cất người dùng đã tự gõ", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.type(
      screen.getByLabelText("parcels.handoff.locationSnapshotLabel"),
      "Kệ 3 sát cửa",
    );
    await user.click(screen.getByLabelText("parcels.handoff.stationLabel"));
    await user.click(screen.getByRole("option", { name: "Kho bến B" }));

    expect(
      screen.getByLabelText("parcels.handoff.locationSnapshotLabel"),
    ).toHaveValue("Kệ 3 sát cửa");
  });

  it("gửi mã bến đã chọn kèm mã kiện để BE đối chiếu", async () => {
    const user = userEvent.setup();
    handoffMock.mockResolvedValue({
      custodyEventId: "event-1",
      parcelId: "parcel-1",
      eventType: "HANDOFF",
      actualLocationType: "WAREHOUSE",
      actualLocationId: stations[0].stationId ?? null,
      occurredAt: "2026-08-24T10:00:00+07:00",
      sequence: 8,
    });
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByLabelText("parcels.handoff.stationLabel"));
    await user.click(screen.getByRole("option", { name: "Kho bến B" }));
    await user.click(
      screen.getByRole("button", { name: "parcels.handoff.submit" }),
    );

    await waitFor(() =>
      expect(handoffMock).toHaveBeenCalledWith("parcel-1", {
        parcelCode: "VR-PCL-20260824-ABCD2345",
        eventType: "HANDOFF",
        actualLocationType: "WAREHOUSE",
        actualLocationId: "36000000-0000-4000-8000-000000000501",
        locationSnapshot: "Kho bến B",
        evidenceReferences: [],
      }),
    );
    expect(onRecorded).toHaveBeenCalled();
  });

  // Thiếu mã vị trí là 422 PARCEL_CUSTODY_LOCATION_REQUIRED — chặn ở đây cho
  // khỏi tốn một vòng mạng.
  it("chặn gửi khi chưa chọn bến", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.click(
      screen.getByRole("button", { name: "parcels.handoff.submit" }),
    );

    expect(handoffMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("parcels.handoff.errors.location-required"),
    ).toBeTruthy();
  });

  // Kiện đang trên xe thì không có mã bến nào để chọn, BE cũng không đòi.
  it("bỏ hẳn ô chọn bến khi vị trí là trên xe", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => expect(stationsMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByLabelText("parcels.handoff.locationTypeLabel"));
    await user.click(
      screen.getByRole("option", { name: "parcelIncidents.locationTypes.VEHICLE" }),
    );

    expect(
      screen.queryByLabelText("parcels.handoff.stationLabel"),
    ).toBeNull();
  });
});
