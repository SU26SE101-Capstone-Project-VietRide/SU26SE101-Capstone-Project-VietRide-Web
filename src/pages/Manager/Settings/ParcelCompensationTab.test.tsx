import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getParcelCompensationPolicy,
  updateParcelCompensationPolicy,
  type ParcelCompensationPolicy,
} from "../../../api/vietride";
import ParcelCompensationTab from "./ParcelCompensationTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../../../components/toast/useToast", () => ({
  useToast: () => ({ error: toastError, success: toastSuccess }),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    getParcelCompensationPolicy: vi.fn(),
    updateParcelCompensationPolicy: vi.fn(),
  };
});

const policyMock = vi.mocked(getParcelCompensationPolicy);
const saveMock = vi.mocked(updateParcelCompensationPolicy);

const platformDefaults = {
  compensationRatePercent: 50,
  maxCompensationVnd: 30_000_000,
  noProofFallbackMultiplier: 4,
  claimWindowDays: 30,
  searchSlaHours: 72,
  decisionSlaBusinessDays: 7,
  payoutSlaBusinessDays: 3,
};

function policy(
  overrides: Partial<ParcelCompensationPolicy> = {},
): ParcelCompensationPolicy {
  return {
    operatorId: "op-1",
    ...platformDefaults,
    version: 1,
    belowDefaultAcknowledged: false,
    platformDefaultPolicy: platformDefaults,
    isBelowPlatformDefault: false,
    effectiveForNewParcelsOnly: true,
    updatedAt: "2026-08-21T12:00:00+07:00",
    updatedBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  policyMock.mockResolvedValue(policy());
});

/**
 * Các ô nhập bị `disabled` trong lúc tải, mà `findByLabelText` khớp ngay từ lần
 * render đầu — thao tác luôn sẽ rơi vào ô đang disabled khi máy chạy chậm. Chờ
 * tiêu đề thật (thay cho nhãn "loading") mới là mốc tab đã tải xong.
 */
async function renderLoadedTab() {
  render(<ParcelCompensationTab />);
  await screen.findByText("settings.parcelCompensation.title");
}

describe("ParcelCompensationTab", () => {
  it("hiện đầy đủ công thức tính tiền đền bù ngay tại chỗ cấu hình", async () => {
    await renderLoadedTab();

    expect(
      screen.getByRole("heading", {
        name: "settings.parcelCompensation.formulaTitle",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.parcelCompensation.formulaAssessedLoss"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.parcelCompensation.formulaCargoWithProof"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.parcelCompensation.formulaCargoWithoutProof"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.parcelCompensation.formulaFreightRefund"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.parcelCompensation.formulaTotal"),
    ).toBeTruthy();
  });

  it("nói rõ chính sách mới chỉ áp cho đơn tạo sau khi lưu", async () => {
    render(<ParcelCompensationTab />);

    expect(
      await screen.findByText("settings.parcelCompensation.newParcelsOnly"),
    ).toBeTruthy();
  });

  it("báo nhà xe chưa cấu hình khi BE trả policy mặc định chưa có updatedAt", async () => {
    policyMock.mockResolvedValue(policy({ updatedAt: null, updatedBy: null }));
    render(<ParcelCompensationTab />);

    expect(
      await screen.findByText("settings.parcelCompensation.neverConfigured"),
    ).toBeTruthy();
    expect(
      screen.queryByText("settings.parcelCompensation.versionLine"),
    ).toBeNull();
  });

  it("lưu đủ bảy trường khi giá trị hợp lệ", async () => {
    const user = userEvent.setup();
    saveMock.mockResolvedValue(policy({ compensationRatePercent: 70 }));
    await renderLoadedTab();

    const rate = screen.getByLabelText(
      "settings.parcelCompensation.fields.compensationRatePercent",
    );
    await user.clear(rate);
    await user.type(rate, "70");
    await user.click(
      screen.getByRole("button", { name: "settings.parcelCompensation.save" }),
    );

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith({
        ...platformDefaults,
        compensationRatePercent: 70,
        belowDefaultAcknowledged: false,
      });
    });
  });

  // BE trả 422 POLICY_BELOW_DEFAULT_ACK_REQUIRED — FE phải hỏi trước, không để
  // người dùng bấm lưu rồi mới biết.
  it("hiện tick xác nhận và chặn lưu khi hạ mức dưới mặc định nền tảng", async () => {
    const user = userEvent.setup();
    await renderLoadedTab();

    const rate = screen.getByLabelText(
      "settings.parcelCompensation.fields.compensationRatePercent",
    );
    await user.clear(rate);
    await user.type(rate, "20");

    expect(
      screen.getByText("settings.parcelCompensation.belowDefaultWarning"),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "settings.parcelCompensation.save" }),
    );
    expect(saveMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "settings.parcelCompensation.errors.ack-required",
      ),
    ).toBeTruthy();

    await user.click(
      screen.getByLabelText("settings.parcelCompensation.belowDefaultAck"),
    );
    saveMock.mockResolvedValue(
      policy({ compensationRatePercent: 20, belowDefaultAcknowledged: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "settings.parcelCompensation.save" }),
    );

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith({
        ...platformDefaults,
        compensationRatePercent: 20,
        belowDefaultAcknowledged: true,
      });
    });
  });

  it("không gọi BE khi giá trị ngoài range của BE", async () => {
    const user = userEvent.setup();
    await renderLoadedTab();

    const searchSla = screen.getByLabelText(
      "settings.parcelCompensation.fields.searchSlaHours",
    );
    await user.clear(searchSla);
    await user.type(searchSla, "999");
    await user.click(
      screen.getByRole("button", { name: "settings.parcelCompensation.save" }),
    );

    expect(saveMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "settings.parcelCompensation.errors.out-of-range",
      ),
    ).toBeTruthy();
  });

  it("nút dùng mặc định nền tảng kéo mọi ô về mức của nền tảng", async () => {
    const user = userEvent.setup();
    policyMock.mockResolvedValue(
      policy({
        compensationRatePercent: 20,
        belowDefaultAcknowledged: true,
        isBelowPlatformDefault: true,
      }),
    );
    await renderLoadedTab();

    await user.click(
      screen.getByRole("button", {
        name: "settings.parcelCompensation.useDefaults",
      }),
    );

    expect(
      screen.getByLabelText(
        "settings.parcelCompensation.fields.compensationRatePercent",
      ),
    ).toHaveValue(50);
    // Về đúng mức nền tảng thì cảnh báo hạ mức phải biến mất
    expect(
      screen.queryByText("settings.parcelCompensation.belowDefaultWarning"),
    ).toBeNull();
  });
});

/**
 * Bảy ô nhập từng kèm bảy đoạn diễn giải + khoảng nhập được, tạo thành một bức
 * tường chữ mà người dùng bỏ đọc hết. Các test dưới đọc thẳng file dịch (mock
 * `t` ở trên trả về key nên không kiểm được nội dung thật) để chốt lại: chỉ ô
 * nào nhãn không nói hết ý mới còn hint.
 */
describe("mật độ chữ của hint", () => {
  const locales = ["vi", "en"] as const;

  // Hai ô này giữ hint vì nhãn không diễn tả được: "lần tiền cước" là một phép
  // nhân, và "Hạn tìm hàng" không nói ra hệ quả hết hạn thì coi như mất.
  const KEEP_HINTS = ["noProofFallbackMultiplier", "searchSlaHours"];

  it.each(locales)("%s chỉ giữ hint cho ô cần giải thích", async (locale) => {
    const messages = (
      await import(`../../../i18n/locales/${locale}/manager.json`)
    ).default;

    expect(
      Object.keys(messages.settings.parcelCompensation.fieldHints).sort(),
    ).toEqual([...KEEP_HINTS].sort());
  });

  // Khoảng nhập được chỉ hữu ích đúng lúc nhập sai, và lúc đó `out-of-range` đã
  // ghi rõ min/max. Hiện sẵn ở cả 7 ô là chữ thừa.
  it.each(locales)("%s không hiện sẵn khoảng nhập được", async (locale) => {
    const messages = (
      await import(`../../../i18n/locales/${locale}/manager.json`)
    ).default;
    const { defaultHint, defaultHintNoMax, errors } =
      messages.settings.parcelCompensation;

    for (const hint of [defaultHint, defaultHintNoMax]) {
      expect(hint).not.toContain("{{min}}");
      expect(hint).not.toContain("{{max}}");
    }

    expect(errors["out-of-range"]).toContain("{{min}}");
    expect(errors["out-of-range"]).toContain("{{max}}");
  });
});

describe("cách diễn giải tiền đền bù", () => {
  const locales = ["vi", "en"] as const;

  it.each(locales)("%s dùng câu nghiệp vụ thay vì cú pháp code", async (locale) => {
    const messages = (
      await import(`../../../i18n/locales/${locale}/manager.json`)
    ).default.settings.parcelCompensation;
    const explanation = [
      messages.formulaAssessedLoss,
      messages.formulaCargoWithProof,
      messages.formulaCargoWithoutProof,
      messages.formulaFreightRefund,
      messages.formulaTotal,
    ].join(" ");

    expect(explanation).not.toMatch(/\b(?:min|max|round)\s*\(/i);
  });
});
