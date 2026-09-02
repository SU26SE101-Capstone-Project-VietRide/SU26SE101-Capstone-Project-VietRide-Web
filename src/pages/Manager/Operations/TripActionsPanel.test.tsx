import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeOperatorTripRoute,
  disruptOperatorTripNoSubstitution,
  getAlternativeRoutes,
  getOperatorIncidents,
  getOperatorTripCargoCapacity,
  getPublicTrip,
  getPublicTripSeatMap,
  previewSubstituteOperatorTripVehicle,
  substituteOperatorTripVehicle,
  type AlternativeRouteListItem,
  type OperatorIncident,
  type OperatorUser,
  type OperatorVehicle,
  type SubstituteVehiclePreviewResult,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import TripActionsPanel, { type TripActionsContext } from "./TripActionsPanel";
import { useToastFeedback } from "../../../hooks/useToastFeedback";

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

// `t` phải nội suy được: nhãn xe thay giờ mang số ghế và mức thiếu, không nội
// suy thì mọi option ra cùng một chuỗi và test không phân biệt được xe nào.
// `defaultValue` bị loại vì nó là fallback của i18next, không phải biến hiển thị.
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
  changeOperatorTripRoute: vi.fn(),
  disruptOperatorTripNoSubstitution: vi.fn(),
  getAlternativeRoutes: vi.fn(),
  getOperatorIncidents: vi.fn(),
  getOperatorTripCargoCapacity: vi.fn(),
  getPublicTrip: vi.fn(),
  getPublicTripSeatMap: vi.fn(),
  previewSubstituteOperatorTripVehicle: vi.fn(),
  substituteOperatorTripVehicle: vi.fn(),
}));

const PREVIEW_TOKEN = "a".repeat(64);
const KEPT_PASSENGER = "passenger-1";
const MOVED_PASSENGER = "passenger-2";

/** Preview mặc định: cả hai khách giữ nguyên ghế (ví dụ 1 của handoff). */
function allSeatsKeptPreview(): SubstituteVehiclePreviewResult {
  return {
    tripId: "trip-1",
    replacementVehicleId: "vehicle-2",
    previewToken: PREVIEW_TOKEN,
    passengers: [
      {
        bookingId: "booking-1",
        passengerId: KEPT_PASSENGER,
        originalSeatNumber: "A1",
        proposedSeatNumber: "A1",
        requiresAdminSelection: false,
        alternativeSeatNumbers: [],
      },
      {
        bookingId: "booking-1",
        passengerId: MOVED_PASSENGER,
        originalSeatNumber: "A2",
        proposedSeatNumber: "A2",
        requiresAdminSelection: false,
        alternativeSeatNumbers: [],
      },
    ],
    availableSeatNumbers: ["A1", "A2", "A3"],
  };
}

/** Xe mới thiếu A2 — đúng ví dụ 2 của handoff. */
function missingSeatPreview(): SubstituteVehiclePreviewResult {
  return {
    ...allSeatsKeptPreview(),
    passengers: [
      allSeatsKeptPreview().passengers[0],
      {
        bookingId: "booking-1",
        passengerId: MOVED_PASSENGER,
        originalSeatNumber: "A2",
        proposedSeatNumber: null,
        requiresAdminSelection: true,
        alternativeSeatNumbers: ["A5", "A10"],
      },
    ],
    availableSeatNumbers: ["A1", "A5", "A10"],
  };
}

/** Sơ đồ ghế giả: `booked` ghế BOOKED + phần còn lại AVAILABLE. */
function seatMap(booked: number, total = 40) {
  return {
    tripId: "trip-1",
    vehicleType: "SEAT_40",
    seats: Array.from({ length: total }, (_, index) => ({
      seatNumber: `A${index + 1}`,
      status: index < booked ? "BOOKED" : "AVAILABLE",
      type: "SEAT",
      row: index,
      col: 1,
      deck: 1,
    })),
  };
}

// Panel nhận đúng mảnh dữ liệu nó dùng, không nhận nguyên item danh sách chuyến
// — nhờ vậy modal Báo cáo sự cố ghép được từ nhiều nguồn và dùng lại cùng panel.
// ĐANG CHẠY là trạng thái duy nhất mở được cả ba thao tác — BE chỉ cho thay xe
// và ghi nhận gián đoạn trên chuyến IN_PROGRESS, nên `canSubstituteVehicle: true`
// chỉ đúng ở trạng thái này.
const tripProp: TripActionsContext = {
  status: "IN_PROGRESS",
  routeId: "route-1",
  vehicleId: "vehicle-1",
  canSubstituteVehicle: true,
};

// Xe và nhân sự do trang cha tải sẵn và truyền xuống qua props
const vehiclesProp: OperatorVehicle[] = [
  {
    id: "vehicle-2",
    operatorId: "operator-1",
    licensePlate: "51B-999.99",
    vehicleTypeId: "type-1",
    totalSeats: 40,
    maxCargoWeightKg: 500,
    maxCargoVolumeM3: 5,
    status: "ACTIVE",
  },
];

// Xe 16 chỗ dùng để dựng tình huống thiếu ghế; `usablePassengerCapacity` mới là
// con số đúng (đã trừ ghế vô hiệu + khu vực tài xế), `totalSeats` chỉ là dự phòng.
const smallVehicle: OperatorVehicle = {
  id: "vehicle-3",
  operatorId: "operator-1",
  licensePlate: "51B-111.11",
  vehicleTypeId: "type-2",
  totalSeats: 16,
  usablePassengerCapacity: 16,
  maxCargoWeightKg: 200,
  maxCargoVolumeM3: 2,
  status: "ACTIVE",
};

// Chiếc xe đang gặp sự cố. Phải NẰM TRONG fleet thì panel mới biết nó bao nhiêu
// ghế — payload chuyến chỉ có biển số + trạng thái. Trạng thái không còn ACTIVE
// vẫn phải tra ra được, vì xe hỏng thường đã bị chuyển sang bảo dưỡng.
const incidentVehicle: OperatorVehicle = {
  id: "vehicle-1",
  operatorId: "operator-1",
  licensePlate: "51B-000.00",
  vehicleTypeId: "type-1",
  totalSeats: 40,
  usablePassengerCapacity: 40,
  maxCargoWeightKg: 500,
  maxCargoVolumeM3: 5,
  status: "MAINTENANCE",
};

// Handoff 2026-08-30: kíp mới phải đủ CẢ tài xế lẫn phụ xe, nên fixture phải có
// một người mỗi vai — thiếu phụ xe là form không submit được.
const staffProp: OperatorUser[] = [
  {
    userId: "driver-2",
    email: "driver@operator.vn",
    displayName: "Driver Two",
    role: "DRIVER",
    status: "ACTIVE",
    operatorId: "operator-1",
  },
  {
    userId: "assistant-2",
    email: "assistant@operator.vn",
    displayName: "Assistant Two",
    role: "ASSISTANT",
    status: "ACTIVE",
    operatorId: "operator-1",
  },
];

// Sự cố của chính chuyến đang xử lý — field bắt buộc của lần thay xe.
const incidentProp: OperatorIncident = {
  incidentId: "incident-1",
  category: "VEHICLE_BREAKDOWN",
  description: null,
  photoUrls: null,
  latitude: null,
  longitude: null,
  reportedAt: "2026-08-30T01:00:00+07:00",
  status: "OPEN",
  resolvedAt: null,
  resolvedByUserId: null,
  resolutionNote: null,
  trip: {
    tripId: "trip-1",
    status: "IN_PROGRESS",
    departureDateTime: "2026-08-30T00:00:00+07:00",
    route: {
      routeId: "route-1",
      name: "SG - Đà Lạt",
      originStation: { stationId: "station-origin", name: "Bến xe Miền Đông" },
      destinationStation: { stationId: "station-dest", name: "Bến xe Đà Lạt" },
    },
  },
  reporter: {
    userId: "driver-1",
    displayName: "Driver One",
    role: "DRIVER",
  },
};

/**
 * Sự cố + kíp mới là ba field bắt buộc mà mọi luồng thay xe phải điền. Gom vào
 * một chỗ để test chỉ còn nói phần nó thật sự kiểm tra (xe nào, thiếu ghế ra sao).
 */
async function chooseIncidentAndCrew(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByLabelText("tripOperations.incident"));
  await user.click(
    await screen.findByRole("option", { name: /incidentOption/ }),
  );
  await user.click(screen.getByLabelText("tripOperations.driver"));
  await user.click(screen.getByRole("option", { name: "Driver Two" }));
  await user.click(screen.getByLabelText("tripOperations.assistant"));
  await user.click(screen.getByRole("option", { name: "Assistant Two" }));
}

// Tuyến thay thế trả về từ API — bản active và bản inactive (bị lọc khỏi danh sách)
const activeAlternative: AlternativeRouteListItem = {
  id: "alt-1",
  routeId: "route-1",
  name: "Tuyến tránh đèo",
  description: "Đi quốc lộ 20",
  destinationStationId: "station-9",
  totalDistanceKm: 320,
  estimatedDurationMinutes: 480,
  isActive: true,
  stops: [],
};

const inactiveAlternative: AlternativeRouteListItem = {
  ...activeAlternative,
  id: "alt-2",
  name: "Tuyến cũ ngưng dùng",
  isActive: false,
};

function alternativesResult(items: AlternativeRouteListItem[]) {
  return {
    items,
    totalItems: items.length,
    page: 1,
    pageSize: 2,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function renderPanel(
  onTripReplaced = vi.fn(),
  trip: TripActionsContext | null = tripProp,
  canMutate = true,
) {
  render(
    <MemoryRouter>
      <TripActionsPanel
        tripId="trip-1"
        trip={trip}
        vehicles={vehiclesProp}
        staff={staffProp}
        canMutate={canMutate}
        onTripReplaced={onTripReplaced}
      />
    </MemoryRouter>,
  );
  return onTripReplaced;
}

describe("TripActionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Panel tự tải sự cố của chuyến để người vận hành chọn — mặc định có đúng
    // một sự cố đang mở, test nào cần khác thì tự mock đè.
    vi.mocked(getOperatorIncidents).mockResolvedValue({
      items: [incidentProp],
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    // Mặc định: 10 khách trên xe 40 chỗ -> xe thay 40 chỗ thừa ghế, không cảnh báo
    vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap(10));
    vi.mocked(getOperatorTripCargoCapacity).mockResolvedValue({
      tripId: "trip-1",
      maxCargoWeightKg: 500,
      reservedWeightKg: 100,
      loadedWeightKg: 50,
      percentFull: 30,
    });
    // Mặc định: xe thay giữ được toàn bộ ghế nên không có bước chọn ghế nào.
    vi.mocked(previewSubstituteOperatorTripVehicle).mockResolvedValue(
      allSeatsKeptPreview(),
    );
    vi.mocked(substituteOperatorTripVehicle).mockResolvedValue({
      tripId: "trip-2",
      oldTripId: "trip-1",
      newTripId: "trip-2",
      status: "SCHEDULED",
    });
    vi.mocked(disruptOperatorTripNoSubstitution).mockResolvedValue({
      tripId: "trip-1",
      status: "DISRUPTED",
    });
    vi.mocked(getAlternativeRoutes).mockResolvedValue(
      alternativesResult([activeAlternative, inactiveAlternative]),
    );
    vi.mocked(changeOperatorTripRoute).mockResolvedValue({
      tripId: "trip-1",
      status: "ROUTE_CHANGED",
      alternativeRouteId: "alt-1",
      affectedBookings: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads cargo capacity for the selected trip", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
    );

    expect(getOperatorTripCargoCapacity).toHaveBeenCalledWith("trip-1");
    expect(await screen.findByText("500 kg")).toBeInTheDocument();
  });

  it("aligns the replace-vehicle chevron with its label", () => {
    renderPanel();

    const summary = screen
      .getAllByText("tripOperations.substitute")
      .map((element) => element.closest("summary"))
      .find((element) => element !== null);

    expect(summary).toHaveClass("items-center");
    expect(summary?.querySelector("svg")).toHaveClass(
      "h-5",
      "w-5",
      "shrink-0",
    );
  });

  it("substitutes a vehicle with the selected crew and reason", async () => {
    const user = userEvent.setup();
    const onTripReplaced = renderPanel();

    expect(
      screen.getByText("tripOperations.notifyPassengers"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("tripOperations.notifyPassengersHint"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );
    await chooseIncidentAndCrew(user);
    await user.type(
      screen.getByLabelText("tripOperations.reason"),
      "Breakdown",
    );
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(substituteOperatorTripVehicle).toHaveBeenCalledWith(
      "trip-1",
      expect.objectContaining({
        replacementVehicleId: "vehicle-2",
        incidentId: "incident-1",
        estimatedRecoveryDepartureAt: expect.any(String),
        reason: "Breakdown",
        notifyPassengers: true,
        replacementCrew: {
          driverId: "driver-2",
          assistantId: "assistant-2",
        },
      }),
    );
    // Trang cha được báo để chuyển selection + URL sang chuyến mới
    expect(onTripReplaced).toHaveBeenCalledWith("trip-2");
  });

  // ── Đồng bộ ghế sau khi thay xe (handoff riêng) ────────────────────────
  //
  // Checklist regression của handoff được dịch thẳng thành các test dưới đây.

  it("giữ được A1/A2 thì không hiện bộ chọn ghế và không gửi seatAssignments", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );

    await waitFor(() => {
      expect(previewSubstituteOperatorTripVehicle).toHaveBeenCalledWith(
        "trip-1",
        { replacementVehicleId: "vehicle-2" },
      );
    });
    // Cả hai khách giữ ghế → không có select nào, không có A10 nào để chọn
    expect(
      await screen.findByText(/tripOperations\.seatPreviewSummary/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/tripOperations\.seatPreviewSelectLabel/),
    ).toBeNull();

    await chooseIncidentAndCrew(user);
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm" }));

    const body = vi.mocked(substituteOperatorTripVehicle).mock.calls[0][1];
    expect(body).not.toHaveProperty("seatAssignments");
    expect(body).not.toHaveProperty("previewToken");
  });

  it("thiếu A2 thì chỉ khách đó có bộ chọn, và gửi kèm previewToken", async () => {
    vi.mocked(previewSubstituteOperatorTripVehicle).mockResolvedValue(
      missingSeatPreview(),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );

    // Đúng MỘT bộ chọn — khách giữ được A1 không được đụng tới
    const selects = await screen.findAllByLabelText(
      /tripOperations\.seatPreviewSelectLabel/,
    );
    expect(selects).toHaveLength(1);

    await user.click(selects[0]);
    await user.click(screen.getByRole("option", { name: "A5" }));

    await chooseIncidentAndCrew(user);
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => {
      expect(substituteOperatorTripVehicle).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({
          previewToken: PREVIEW_TOKEN,
          seatAssignments: [
            { passengerId: MOVED_PASSENGER, newSeatNumber: "A5" },
          ],
        }),
      );
    });
  });

  it("chưa chọn đủ ghế thì KHÔNG gọi API đổi xe", async () => {
    vi.mocked(previewSubstituteOperatorTripVehicle).mockResolvedValue(
      missingSeatPreview(),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );
    await screen.findAllByLabelText(/tripOperations\.seatPreviewSelectLabel/);
    await chooseIncidentAndCrew(user);
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");

    // Nút bị khoá hẳn: gửi lên chỉ ăn `409 REPLACEMENT_SEAT_ASSIGNMENT_REQUIRED`
    expect(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    ).toBeDisabled();
    expect(substituteOperatorTripVehicle).not.toHaveBeenCalled();
  });

  it("không cho hai khách chọn cùng một ghế", async () => {
    const twoMoved = missingSeatPreview();
    twoMoved.passengers = [
      {
        bookingId: "booking-1",
        passengerId: KEPT_PASSENGER,
        originalSeatNumber: "A1",
        proposedSeatNumber: null,
        requiresAdminSelection: true,
        alternativeSeatNumbers: ["A5", "A10"],
      },
      twoMoved.passengers[1],
    ];
    vi.mocked(previewSubstituteOperatorTripVehicle).mockResolvedValue(twoMoved);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );

    const selects = await screen.findAllByLabelText(
      /tripOperations\.seatPreviewSelectLabel/,
    );
    await user.click(selects[0]);
    await user.click(screen.getByRole("option", { name: "A5" }));

    // Khách thứ hai không còn thấy A5 trong danh sách
    await user.click(selects[1]);
    expect(screen.queryByRole("option", { name: "A5" })).toBeNull();
    expect(screen.getByRole("option", { name: "A10" })).toBeInTheDocument();
  });

  it("token preview cũ thì xếp lại ghế thay vì gửi lại body cũ", async () => {
    vi.mocked(previewSubstituteOperatorTripVehicle).mockResolvedValue(
      missingSeatPreview(),
    );
    vi.mocked(substituteOperatorTripVehicle).mockRejectedValue(
      new ApiRequestError(
        "Seat preview is stale.",
        409,
        "REPLACEMENT_SEAT_PREVIEW_STALE",
      ),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );
    const selects = await screen.findAllByLabelText(
      /tripOperations\.seatPreviewSelectLabel/,
    );
    await user.click(selects[0]);
    await user.click(screen.getByRole("option", { name: "A5" }));
    await chooseIncidentAndCrew(user);
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm" }));

    // Lượt preview thứ hai là do lỗi stale kích hoạt, không phải do đổi xe
    await waitFor(() => {
      expect(previewSubstituteOperatorTripVehicle).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByText("tripOperations.errorSeatPreviewStaleHint"),
    ).toBeInTheDocument();
  });

  it("BE báo thiếu ghế ngay ở bước preview thì hiện ba con số của BE", async () => {
    vi.mocked(previewSubstituteOperatorTripVehicle).mockRejectedValue(
      new ApiRequestError(
        "Replacement vehicle does not have enough usable seats.",
        409,
        "REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS",
        [
          // Đảo thứ tự: FE phải đọc `error.fields[]` theo TÊN
          { field: "missingSeats", message: "1" },
          { field: "usableSeats", message: "2" },
          { field: "passengersToTransfer", message: "3" },
        ],
      ),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );

    // Mặc định của test là 10 khách / xe 40 chỗ nên FE không tự cảnh báo gì —
    // mọi con số ở đây đều đến từ BE, và đến TRƯỚC khi bấm xác nhận.
    expect(
      await screen.findByText(
        "tripOperations.seatShortageServerBody seats=2 passengers=3 missing=1",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("tripOperations.seatShortagePickAnotherVehicle"),
    ).toBeInTheDocument();
    expect(substituteOperatorTripVehicle).not.toHaveBeenCalled();
  });

  it("preview hỏng thì báo lỗi và cho thử lại, không khoá luôn màn", async () => {
    vi.mocked(previewSubstituteOperatorTripVehicle).mockRejectedValue(
      new ApiRequestError(
        "Replacement vehicle does not have enough usable seats.",
        409,
        "REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS",
      ),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );

    const retry = await screen.findByRole("button", {
      name: "tripOperations.seatPreviewRetry",
    });
    await user.click(retry);

    await waitFor(() => {
      expect(previewSubstituteOperatorTripVehicle).toHaveBeenCalledTimes(2);
    });
  });

  it("hiện nhãn chuyến thay thế thay vì UUID thô sau khi đổi xe", async () => {
    vi.mocked(getPublicTrip).mockResolvedValue({
      tripId: "trip-2",
      tripCode: "TRIP-20260826-ABCD1234",
      operatorId: "operator-1",
      routeId: "route-1",
      status: "SCHEDULED",
      departureTime: "2026-08-26T08:00:00+07:00",
      estimatedArrivalTime: "2026-08-26T10:00:00+07:00",
      baseFare: 200000,
      originStation: { id: "station-origin", name: "Bến xe Miền Đông" },
      destinationStation: { id: "station-dest", name: "Bến xe Đà Lạt" },
      stops: [],
    });

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );
    await chooseIncidentAndCrew(user);
    await user.type(
      screen.getByLabelText("tripOperations.reason"),
      "Breakdown",
    );
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => {
      expect(useToastFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("TRIP-20260826-ABCD1234"),
          error: "",
        }),
      );
    });
    expect(getPublicTrip).toHaveBeenCalledWith("trip-2");
    expect(useToastFeedback).not.toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("trip-2"),
      }),
    );
  });

  describe("kiểm tra đủ ghế trước khi thay xe", () => {
    // Panel tải sơ đồ ghế lúc mount; các test dưới đổi mock TRƯỚC khi render.
    function renderWithSeats(booked: number, onSubstituted = vi.fn()) {
      vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap(booked));
      render(
        <MemoryRouter>
          <TripActionsPanel
            tripId="trip-1"
            trip={tripProp}
            vehicles={[vehiclesProp[0], smallVehicle]}
            staff={staffProp}
            canMutate
            onSubstituted={onSubstituted}
          />
        </MemoryRouter>,
      );
      return onSubstituted;
    }

    async function chooseVehicle(
      user: ReturnType<typeof userEvent.setup>,
      pattern: RegExp,
    ) {
      await user.click(screen.getByLabelText("tripOperations.vehicle"));
      await user.click(await screen.findByRole("option", { name: pattern }));
    }

    it("gắn nhãn thiếu bao nhiêu ghế và xếp xe đủ ghế lên trước", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await user.click(screen.getByLabelText("tripOperations.vehicle"));

      // 30 khách: xe 40 chỗ đủ, xe 16 chỗ thiếu 14
      const options = await screen.findAllByRole("option");
      const labels = options.map((option) => option.textContent ?? "");
      expect(labels[1]).toContain("vehicleSeatsOption");
      expect(labels[1]).toContain("plate=51B-999.99");
      expect(labels[2]).toContain("vehicleSeatsShortOption");
      expect(labels[2]).toContain("missing=14");
    });

    // Cảnh báo này ĐOÁN từ sơ đồ ghế nên chỉ để báo sớm, không phải chốt chặn:
    // nó có thể đếm dư (xem `usableSeats`) và khoá nhầm một chiếc xe thật ra
    // vẫn chở đủ. Chốt chặn là preview của BE (test ở dưới).
    it("cảnh báo thiếu ghế và chỉ đường chọn xe khác, không còn ô tick bỏ qua", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);

      expect(
        screen.getByText(/tripOperations\.seatShortageBody/),
      ).toBeInTheDocument();
      expect(
        screen.getByText("tripOperations.seatShortagePickAnotherVehicle"),
      ).toBeInTheDocument();
      // BE chặn cứng thiếu ghế nên không còn đường "vẫn đổi xe" nào để tick
      expect(
        screen.queryByRole("checkbox", { name: /seatShortageAck/ }),
      ).not.toBeInTheDocument();
    });

    it("không cảnh báo khi không đọc được sơ đồ ghế", async () => {
      const user = userEvent.setup();
      vi.mocked(getPublicTripSeatMap).mockRejectedValue(new Error("boom"));
      render(
        <MemoryRouter>
          <TripActionsPanel
            tripId="trip-1"
            trip={tripProp}
            vehicles={[vehiclesProp[0], smallVehicle]}
            staff={staffProp}
            canMutate
          />
        </MemoryRouter>,
      );

      // Nói thẳng là không kiểm được, và KHÔNG chặn thao tác
      expect(
        await screen.findByText(/tripOperations\.seatCountUnknown/),
      ).toBeInTheDocument();
      await chooseVehicle(user, /plate=51B-111\.11/);
      expect(
        screen.queryByText(/tripOperations\.seatShortageBody/),
      ).not.toBeInTheDocument();
    });

    it("đẩy kết quả thay xe lên trang cha kèm số khách chưa có ghế", async () => {
      const user = userEvent.setup();
      vi.mocked(substituteOperatorTripVehicle).mockResolvedValue({
        tripId: "trip-2",
        oldTripId: "trip-1",
        newTripId: "trip-2",
        status: "SCHEDULED",
        affectedBookingCount: 12,
        affectedPassengerCount: 30,
        pendingSeatAssignmentCount: 14,
      });
      const onSubstituted = renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);
      await chooseIncidentAndCrew(user);
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );
      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));

      // Trang cha phải nhận được kết quả: panel bị remount sau khi đổi chuyến.
      // Tham số thứ hai là bản tóm tắt "trước/sau" để trang cha dựng thông báo.
      await waitFor(() =>
        expect(onSubstituted).toHaveBeenCalledWith(
          expect.objectContaining({ pendingSeatAssignmentCount: 14 }),
          expect.objectContaining({
            newVehiclePlate: "51B-111.11",
            newDriverName: "Driver Two",
            newAssistantName: "Assistant Two",
          }),
        ),
      );
      expect(
        await screen.findByText(/substitutionResultPendingHint/),
      ).toBeInTheDocument();
      expect(screen.getByText("14")).toBeInTheDocument();
    });
  });

  /**
   * Xe thay phải ĐÚNG số ghế với xe bị sự cố — khác hẳn quy tắc "đủ ghế cho số
   * khách" ở trên: chuyến thay thế dựng lại sơ đồ ghế theo xe mới, nên chỉ khi
   * hai xe cùng số ghế thì khách mới giữ được đúng chỗ đã đặt. Đây là điều kiện
   * BẮT BUỘC, không có ô tick bỏ qua như cảnh báo thiếu ghế.
   */
  describe("xe thay phải đúng số ghế với xe bị sự cố", () => {
    function renderWithIncidentVehicle(fleet: OperatorVehicle[]) {
      const onSubstituted = vi.fn();
      render(
        <MemoryRouter>
          <TripActionsPanel
            tripId="trip-1"
            trip={tripProp}
            vehicles={fleet}
            staff={staffProp}
            canMutate
            onSubstituted={onSubstituted}
          />
        </MemoryRouter>,
      );
      return onSubstituted;
    }

    async function openVehicleSelect(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(screen.getByLabelText("tripOperations.vehicle"));
      return screen.findAllByRole("option");
    }

    it("khoá xe khác số ghế và xếp xe đúng ghế lên trước", async () => {
      const user = userEvent.setup();
      // Xe hỏng 40 ghế; fleet để xe 16 chỗ đứng TRƯỚC xe 40 chỗ để thấy rõ
      // panel sắp lại chứ không giữ nguyên thứ tự nhận được.
      renderWithIncidentVehicle([incidentVehicle, smallVehicle, vehiclesProp[0]]);

      const options = await openVehicleSelect(user);
      const labels = options.map((option) => option.textContent ?? "");

      // Xe hỏng không nằm trong danh sách xe thay
      expect(labels.join(" ")).not.toContain("51B-000.00");
      expect(labels[1]).toContain("vehicleSeatsOption");
      expect(labels[1]).toContain("plate=51B-999.99");
      expect(options[1]).toBeEnabled();
      expect(labels[2]).toContain("vehicleSeatsMismatchOption");
      expect(labels[2]).toContain("required=40");
      expect(options[2]).toBeDisabled();

      // Dòng nhắc nói thẳng con số bắt buộc, không bắt người dùng tự suy
      expect(
        screen.getByText(/seatCountRequired.*required=40/),
      ).toBeInTheDocument();
    });

    it("không cho chọn xe khác số ghế", async () => {
      const user = userEvent.setup();
      renderWithIncidentVehicle([incidentVehicle, vehiclesProp[0], smallVehicle]);

      const options = await openVehicleSelect(user);
      await user.click(options[2]);

      // Bấm vào option bị khoá không chọn được gì: ô chọn vẫn ở placeholder.
      // Danh sách đang mở nên nhãn này khớp cả nút chọn lẫn listbox — phần tử
      // đầu theo thứ tự DOM là nút chọn.
      expect(
        screen.getAllByLabelText("tripOperations.vehicle")[0],
      ).toHaveTextContent("tripOperations.selectVehicle");
      // Và không có cảnh báo lệch ghế, vì có chọn được đâu mà lệch
      expect(
        screen.queryByText(/seatCountMismatchBlocked/),
      ).not.toBeInTheDocument();
    });

    it("vẫn thay được xe đúng số ghế", async () => {
      const user = userEvent.setup();
      renderWithIncidentVehicle([incidentVehicle, vehiclesProp[0], smallVehicle]);

      await user.click(screen.getByLabelText("tripOperations.vehicle"));
      await user.click(
        await screen.findByRole("option", { name: /plate=51B-999\.99/ }),
      );
      await chooseIncidentAndCrew(user);
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );
      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));

      await waitFor(() =>
        expect(substituteOperatorTripVehicle).toHaveBeenCalledWith(
          "trip-1",
          expect.objectContaining({ replacementVehicleId: "vehicle-2" }),
        ),
      );
    });

    it("báo khi cả fleet không còn xe nào đúng số ghế", async () => {
      renderWithIncidentVehicle([incidentVehicle, smallVehicle]);

      expect(
        await screen.findByText(/seatCountNoMatch.*required=40/),
      ).toBeInTheDocument();
    });

    it("không chặn khi không tra được xe bị sự cố trong fleet", async () => {
      const user = userEvent.setup();
      // Fleet thiếu `vehicle-1` = CHƯA BIẾT số ghế xe cũ. Không đoán bừa, để BE
      // quyết định — xe 16 chỗ vẫn chọn được như trước.
      renderWithIncidentVehicle([vehiclesProp[0], smallVehicle]);

      const options = await openVehicleSelect(user);
      expect(options[1]).toBeEnabled();
      expect(options[2]).toBeEnabled();
      expect(
        screen.queryByText(/tripOperations\.seatCountRequired/),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * BE CHẶN CỨNG việc thay sang xe thiếu ghế bằng `409
   * REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS`, và `acknowledgeInsufficientSeats`
   * chỉ được ghi vào audit payload chứ KHÔNG bỏ qua guard
   * (`SubstituteVehicleCommandHandler`). Vì vậy không còn thao tác "vẫn đổi
   * xe": ba con số trong `error.fields[]` là kết luận, và việc phải làm là
   * chọn xe khác.
   */
  describe("BE từ chối vì xe thay thiếu ghế", () => {
    function seatShortageError() {
      return new ApiRequestError(
        "Replacement vehicle does not have enough usable seats.",
        409,
        "REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS",
        [
          // Cố tình đảo thứ tự so với ví dụ trong handoff: FE phải đọc theo TÊN.
          { field: "missingSeats", message: "1" },
          { field: "usableSeats", message: "2" },
          { field: "passengersToTransfer", message: "3" },
        ],
      );
    }

    async function submitSubstitution(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(screen.getByLabelText("tripOperations.vehicle"));
      await user.click(
        await screen.findByRole("option", { name: /plate=51B-999\.99/ }),
      );
      await chooseIncidentAndCrew(user);
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );
      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));
    }

    it("hiện đúng ba con số của BE thay vì số FE tự đếm", async () => {
      const user = userEvent.setup();
      vi.mocked(substituteOperatorTripVehicle).mockRejectedValueOnce(
        seatShortageError(),
      );
      renderPanel();

      await submitSubstitution(user);

      // Mặc định của test là 10 khách / xe 40 chỗ nên FE KHÔNG cảnh báo gì;
      // mọi con số hiện ra ở đây đều đến từ BE.
      expect(
        await screen.findByText(
          "tripOperations.seatShortageServerBody seats=2 passengers=3 missing=1",
        ),
      ).toBeInTheDocument();
    });

    it("KHÔNG gửi lại lần hai — thiếu ghế là đường cụt, phải chọn xe khác", async () => {
      const user = userEvent.setup();
      // `mockRejectedValue` (không phải `Once`): nếu FE lỡ gửi lại thì lượt hai
      // cũng hỏng đúng như BE thật, test không vô tình xanh.
      vi.mocked(substituteOperatorTripVehicle).mockRejectedValue(
        seatShortageError(),
      );
      renderPanel();

      await submitSubstitution(user);

      await waitFor(() =>
        expect(substituteOperatorTripVehicle).toHaveBeenCalledTimes(1),
      );
      // Không còn hộp "vẫn đổi xe" — BE chỉ ghi cờ ack vào audit chứ không dùng
      // nó để bỏ qua guard, nên gửi lại lần nào cũng `409`.
      expect(
        screen.queryByRole("button", {
          name: "tripOperations.seatShortageProceed",
        }),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText("tripOperations.seatShortagePickAnotherVehicle"),
      ).toBeInTheDocument();
    });

    it("không gửi kèm acknowledgeInsufficientSeats nữa", async () => {
      const user = userEvent.setup();
      renderPanel();

      await submitSubstitution(user);

      await waitFor(() =>
        expect(substituteOperatorTripVehicle).toHaveBeenCalled(),
      );
      expect(
        vi.mocked(substituteOperatorTripVehicle).mock.calls[0][1],
      ).not.toHaveProperty("acknowledgeInsufficientSeats");
    });
  });

  it("disrupts the selected trip with a reason after confirm", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("tripOperations.reason"), "Storm");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.disrupt" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(disruptOperatorTripNoSubstitution).toHaveBeenCalledWith("trip-1", {
      reason: "Storm",
    });
  });

  it("changes the trip route via an active alternative after confirm", async () => {
    const user = userEvent.setup();
    const onTripReplaced = renderPanel();

    // Mở section đổi lộ trình — panel tải danh sách tuyến thay thế của tuyến hiện tại
    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    );
    expect(getAlternativeRoutes).toHaveBeenCalledWith("route-1", {
      page: 1,
      pageSize: 2,
    });

    // Chỉ tuyến active được hiển thị để chọn
    const radio = await screen.findByRole("radio", {
      name: /Tuyến tránh đèo/,
    });
    expect(screen.queryByText("Tuyến cũ ngưng dùng")).not.toBeInTheDocument();

    await user.click(radio);
    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRouteApply" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(changeOperatorTripRoute).toHaveBeenCalledWith("trip-1", {
      alternativeRouteId: "alt-1",
    });
    // Trang cha re-select cùng tripId để tải lại geometry lộ trình mới + fleet
    expect(useToastFeedback).toHaveBeenCalledWith({
      message: expect.stringContaining("tripOperations.changeRouteSuccess"),
      error: "",
    });
    expect(onTripReplaced).toHaveBeenCalledWith("trip-1");
  });

  it("shows the declare-alternatives hint when the route has none active", async () => {
    const user = userEvent.setup();
    vi.mocked(getAlternativeRoutes).mockResolvedValue(
      alternativesResult([inactiveAlternative]),
    );
    renderPanel();

    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    );

    expect(
      await screen.findByText("tripOperations.noAlternatives"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "tripOperations.declareAlternatives" }),
    ).toHaveAttribute(
      "href",
      "/manager/routes?routeId=route-1&tab=alternatives",
    );
    expect(changeOperatorTripRoute).not.toHaveBeenCalled();
  });

  // BE chặn mọi mutation trên chuyến đã kết thúc bằng 409 TRIP_NOT_EDITABLE.
  // Trước đây FE vẫn hiện đủ form nên người dùng bấm xong mới thấy lỗi.
  it.each(["COMPLETED", "CANCELLED", "DISRUPTED"])(
    "ẩn thao tác sửa chuyến khi trạng thái là %s",
    (status) => {
      renderPanel(vi.fn(), { ...tripProp, status });

      expect(
        screen.getByText(/tripOperations\.notEditable/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "tripOperations.changeRoute" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "tripOperations.disrupt" }),
      ).not.toBeInTheDocument();
      // Sức chứa là GET, vẫn tra cứu được trên chuyến đã xong
      expect(
        screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
      ).toBeInTheDocument();
    },
  );

  it("giữ nguyên thao tác khi chuyến còn sửa được", () => {
    renderPanel();

    expect(
      screen.queryByText(/tripOperations\.notEditable/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/tripOperations\.notDisruptableYet/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.disrupt" }),
    ).toBeInTheDocument();
  });

  // Thay xe / ghi nhận gián đoạn hẹp hơn đổi lộ trình: BE bắt buộc IN_PROGRESS
  // (409 TRIP_NOT_SUBSTITUTABLE). Chuyến chưa lăn bánh vẫn phải đổi lộ trình được.
  it.each(["SCHEDULED", "BOARDING"])(
    "chỉ mở đổi lộ trình khi chuyến ở trạng thái %s",
    (status) => {
      renderPanel(vi.fn(), { ...tripProp, status });

      expect(
        screen.getByText(/tripOperations\.notDisruptableYet/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/tripOperations\.notEditable/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "tripOperations.disrupt" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "tripOperations.changeRoute" }),
      ).toBeInTheDocument();
    },
  );

  // Deep-link mở panel trước khi fleet có chuyến đó: chưa biết trạng thái thì
  // không được tự khoá, thà để BE từ chối còn hơn chặn nhầm.
  it("không tự khoá khi chưa biết trạng thái chuyến", () => {
    renderPanel(vi.fn(), null);

    expect(
      screen.queryByText(/tripOperations\.notEditable/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
  });
});
