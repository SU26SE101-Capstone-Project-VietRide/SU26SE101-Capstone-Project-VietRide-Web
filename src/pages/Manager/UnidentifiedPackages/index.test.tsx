import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUnidentifiedPackage,
  getUnidentifiedPackageMatchCandidates,
  getUnidentifiedPackages,
  matchUnidentifiedPackage,
  registerUnidentifiedPackage,
  type UnidentifiedPackage,
  type UnidentifiedPackageMatchCandidate,
} from "../../../api/vietride";
import UnidentifiedPackagesPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getUnidentifiedPackages: vi.fn(),
  getUnidentifiedPackage: vi.fn(),
  getUnidentifiedPackageMatchCandidates: vi.fn(),
  matchUnidentifiedPackage: vi.fn(),
  registerUnidentifiedPackage: vi.fn(),
  UNIDENTIFIED_PACKAGE_STATUSES: ["UNIDENTIFIED", "MATCHED"],
  PARCEL_CUSTODY_LOCATION_TYPES: ["WAREHOUSE", "VEHICLE"],
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../../../utils/firebaseImageUpload", () => ({
  FirebaseImageError: class FirebaseImageError extends Error {},
  uploadFirebaseImages: vi.fn(async () => ["https://cdn.example/x.jpg"]),
}));

const packageItem: UnidentifiedPackage = {
  packageId: "36000000-0000-4000-8000-000000002001",
  temporaryExceptionTag: "TMP-BEN-B-001",
  operatorId: "36000000-0000-4000-8000-000000000301",
  status: "UNIDENTIFIED",
  locationType: "WAREHOUSE",
  locationId: "36000000-0000-4000-8000-000000000502",
  matchedParcelId: null,
  createdAt: "2026-08-21T10:00:00+07:00",
  tripId: null,
  locationSnapshot: "Kho bến B",
  description: "Thùng carton nâu",
  observedWeightKg: 4.2,
  evidenceReferences: ["https://cdn.example/a.jpg"],
  createdByUserId: "user-1",
  matchedAt: null,
  matchedByUserId: null,
  trip: null,
  matchedParcel: null,
  availableActions: ["VIEW_MATCH_CANDIDATES", "MATCH"],
};

const candidate: UnidentifiedPackageMatchCandidate = {
  parcelId: "36000000-0000-4000-8000-000000000201",
  parcelCode: "VR-PCL-20260821-ABCD2345",
  trip: { tripId: "trip-1", stops: [] },
  photoUrl: null,
  description: "Thùng carton nâu",
  weightKg: 4.1,
  expectedDropoff: { type: "ROUTE_STOP", name: "Bến C" },
  matchReasons: ["SAME_TRIP_MANIFEST"],
};

const listMock = vi.mocked(getUnidentifiedPackages);
const detailMock = vi.mocked(getUnidentifiedPackage);
const candidatesMock = vi.mocked(getUnidentifiedPackageMatchCandidates);
const matchMock = vi.mocked(matchUnidentifiedPackage);
const registerMock = vi.mocked(registerUnidentifiedPackage);

function mockList(items: UnidentifiedPackage[] = [packageItem]) {
  listMock.mockResolvedValue({
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList();
  detailMock.mockResolvedValue(packageItem);
  candidatesMock.mockResolvedValue([candidate]);
});

describe("UnidentifiedPackagesPage", () => {
  it("hiện hàng đợi kiện chưa định danh", async () => {
    render(<UnidentifiedPackagesPage />);

    expect(await screen.findByText("TMP-BEN-B-001")).toBeTruthy();
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("mở chi tiết thì tải danh sách đơn ứng viên", async () => {
    const user = userEvent.setup();
    render(<UnidentifiedPackagesPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));

    expect(await screen.findByText("VR-PCL-20260821-ABCD2345")).toBeTruthy();
    expect(candidatesMock).toHaveBeenCalledWith(packageItem.packageId, {
      limit: 20,
    });
  });

  // Ghép lại kiện đã ghép làm BE ném raw exception thành 500 — nút phải biến
  // mất theo `availableActions` chứ không dựa vào lỗi trả về.
  it("ẩn nút ghép khi BE không còn cho MATCH", async () => {
    const user = userEvent.setup();
    detailMock.mockResolvedValue({
      ...packageItem,
      status: "MATCHED",
      availableActions: [],
    });
    render(<UnidentifiedPackagesPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await screen.findByText("unidentifiedPackages.detailTitle");

    expect(
      screen.queryByRole("button", { name: "unidentifiedPackages.matchAction" }),
    ).toBeNull();
    // Không còn chờ ghép thì cũng không đi hỏi candidate làm gì
    expect(candidatesMock).not.toHaveBeenCalled();
  });

  it("ghép kiện sau khi xác nhận", async () => {
    const user = userEvent.setup();
    matchMock.mockResolvedValue({
      ...packageItem,
      status: "MATCHED",
      matchedParcelId: candidate.parcelId,
      availableActions: [],
    });
    render(<UnidentifiedPackagesPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "unidentifiedPackages.matchAction",
      }),
    );
    // Nút trong hộp xác nhận mang cùng nhãn — lấy cái cuối cùng vừa mở
    const confirmButtons = await screen.findAllByRole("button", {
      name: "unidentifiedPackages.matchAction",
    });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(matchMock).toHaveBeenCalledWith(packageItem.packageId, {
        parcelId: candidate.parcelId,
      });
    });
  });

  it("đăng ký kiện mới gửi đúng payload BE cần", async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue(packageItem);
    render(<UnidentifiedPackagesPage />);

    await user.click(
      await screen.findByRole("button", {
        name: /unidentifiedPackages.registerAction/,
      }),
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.tagLabel/),
      "TMP-BEN-B-002",
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.locationIdLabel/),
      "36000000-0000-4000-8000-000000000502",
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.descriptionLabel/),
      "Thùng xốp",
    );
    // Ảnh giờ chọn từ máy rồi đẩy lên Firebase, không dán link nữa
    fireEvent.change(screen.getByTestId("evidence-file-input"), {
      target: {
        files: [new File(["anh"], "kien.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByAltText("evidenceUpload.photoIndex 1")).toBeTruthy(),
    );
    await user.click(
      screen.getByRole("button", { name: "unidentifiedPackages.registerSubmit" }),
    );

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        temporaryExceptionTag: "TMP-BEN-B-002",
        locationType: "WAREHOUSE",
        locationId: "36000000-0000-4000-8000-000000000502",
        description: "Thùng xốp",
        evidenceReferences: ["https://cdn.example/x.jpg"],
      });
    });
  });

  it("không gọi BE khi thiếu ảnh chứng minh", async () => {
    const user = userEvent.setup();
    render(<UnidentifiedPackagesPage />);

    await user.click(
      await screen.findByRole("button", {
        name: /unidentifiedPackages.registerAction/,
      }),
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.tagLabel/),
      "TMP-BEN-B-003",
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.locationIdLabel/),
      "36000000-0000-4000-8000-000000000502",
    );
    await user.type(
      screen.getByLabelText(/unidentifiedPackages.descriptionLabel/),
      "Thùng xốp",
    );
    await user.click(
      screen.getByRole("button", { name: "unidentifiedPackages.registerSubmit" }),
    );

    expect(registerMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "unidentifiedPackages.registerErrors.evidence-required",
      ),
    ).toBeTruthy();
  });
});
