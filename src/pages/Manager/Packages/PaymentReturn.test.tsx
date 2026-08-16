import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorSubscription,
  getVnPayReturnStatus,
  type OperatorSubscriptionDetail,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import SubscriptionPaymentReturn from "./PaymentReturn";
import {
  getSubscriptionPaymentIntent,
  saveSubscriptionPaymentIntent,
} from "./subscriptionPaymentIntent";

const translate = (
  key: string,
  options?: Record<string, string | number>,
) => {
  if (options?.name) return `${key} ${options.name}`;
  if (options?.code) return `${key} ${options.code}`;
  if (options?.seconds !== undefined) return `${key} ${options.seconds}`;
  return key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../components/LanguageSwitcher", () => ({
  default: () => <div>language-switcher</div>,
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
  getVnPayReturnStatus: vi.fn(),
}));

const plan: SubscriptionPlan = {
  planId: "plan-enterprise",
  name: "Enterprise",
  description: "Enterprise plan",
  pricePerMonth: 4_000_000,
  pricePerYear: 39_900_000,
  limits: {
    maxVehicles: 100,
    maxDrivers: 100,
    maxAssistants: 100,
    maxOperatorUsers: 50,
    maxRoutes: 50,
    maxTripsPerMonth: 5_000,
  },
  modules: {
    enableParcel: true,
    enableShuttle: true,
    enableRag: true,
  },
  isActive: true,
};

const subscription: OperatorSubscriptionDetail = {
  subscriptionId: "subscription-1",
  status: "ACTIVE",
  billingPeriod: "YEARLY",
  startedAt: "2026-07-16T00:00:00Z",
  expiresAt: "2027-07-16T00:00:00Z",
  plan,
  usage: {
    currentVehicles: 1,
    currentDrivers: 2,
    currentAssistants: 1,
    currentOperatorUsers: 3,
    currentRoutes: 4,
    currentTripsThisMonth: 10,
  },
  pendingUpgrade: null,
};

function signIn() {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresInSeconds: 3600,
      user: {
        id: "user-1",
        email: "manager@vietride.test",
        displayName: "Manager",
        phone: "0900000000",
        role: "OPERATOR_ADMIN",
      },
    }),
  );
}

describe("SubscriptionPaymentReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    signIn();
    vi.mocked(getOperatorSubscription).mockResolvedValue(subscription);
    vi.mocked(getVnPayReturnStatus).mockResolvedValue({
      vnPayTxnRef: "VR-SUBSCRIPTION-001",
      paymentId: "payment-1",
      referenceType: "SUBSCRIPTION",
      referenceId: "subscription-1",
      status: "PENDING_REDIRECT",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("verifies a successful VNPay return with the backend", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/payments/return?vnp_ResponseCode=00&vnp_TransactionNo=VNP123",
        ]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.successTitle"),
    ).toBeInTheDocument();
    // Ưu tiên mã giao dịch Backend đã xác thực chữ ký, không phải giá trị đọc
    // thẳng từ URL (URL có thể bị sửa tay).
    expect(screen.getByText("VR-SUBSCRIPTION-001")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "paymentReturn.backToPackages" }),
    ).toHaveAttribute("href", "/manager/packages");
    expect(getOperatorSubscription).toHaveBeenCalledTimes(1);
  });

  // VNPay có thể trả về một origin khác console (app.vietride.online vs
  // vietride.online). Khai VITE_APP_BASE_URL thì nút quay lại phải là URL tuyệt
  // đối sang console thật, không phải path tương đối của origin đang đứng.
  it("trỏ nút quay lại sang origin console khi có VITE_APP_BASE_URL", async () => {
    // Dấu "/" thừa ở cuối là lỗi cấu hình thường gặp — không được đẻ ra
    // "https://vietride.online//manager/packages".
    vi.stubEnv("VITE_APP_BASE_URL", "https://vietride.online/");

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00&vnp_TxnRef=VR-1"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", { name: "paymentReturn.backToPackages" }),
    ).toHaveAttribute("href", "https://vietride.online/manager/packages");

    vi.unstubAllEnvs();
  });

  it("forwards the raw VNPay query to the backend status endpoint untouched", async () => {
    const rawQuery =
      "?vnp_Amount=1000000&vnp_ResponseCode=00&vnp_TxnRef=VR-1&vnp_SecureHash=abc%2Fdef%2B123";

    render(
      <MemoryRouter initialEntries={[`/payments/return${rawQuery}`]}>
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    await screen.findByText("paymentReturn.successTitle");
    // Không parse/lọc/sắp lại param — chữ ký tính trên đúng chuỗi này
    expect(getVnPayReturnStatus).toHaveBeenCalledWith(rawQuery);
  });

  it("shows an invalid result when the backend rejects the VNPay signature", async () => {
    vi.mocked(getVnPayReturnStatus).mockRejectedValue(
      new ApiRequestError("Invalid signature", 401, "PAYMENT_SIGNATURE_INVALID"),
    );
    saveSubscriptionPaymentIntent({
      paymentId: "payment-1",
      upgradeAttemptId: "attempt-1",
      targetPlanId: "plan-enterprise",
      targetPlanName: "Enterprise",
    });

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00&vnp_TxnRef=VR-1"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.invalidTitle"),
    ).toBeInTheDocument();
    // Chữ ký sai thì tuyệt đối không được xác nhận qua subscription
    expect(getOperatorSubscription).not.toHaveBeenCalled();
    expect(getSubscriptionPaymentIntent()).toBeNull();
  });

  it("shows a not-found result when the backend cannot match the payment", async () => {
    vi.mocked(getVnPayReturnStatus).mockRejectedValue(
      new ApiRequestError("Payment not found", 404, "PAYMENT_NOT_FOUND"),
    );

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00&vnp_TxnRef=VR-1"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.notFoundTitle"),
    ).toBeInTheDocument();
    expect(getOperatorSubscription).not.toHaveBeenCalled();
  });

  it("shows a failed result without confirming it through subscription data", async () => {
    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=05"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.failedTitle"),
    ).toBeInTheDocument();
    expect(getOperatorSubscription).not.toHaveBeenCalled();
  });

  it("returns to the packages page five seconds after a verified payment", async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00"]}
      >
        <Routes>
          <Route
            path="/payments/return"
            element={<SubscriptionPaymentReturn />}
          />
          <Route path="/manager/packages" element={<div>packages-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByText("paymentReturn.redirectingToPackages 5"),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText("packages-page")).toBeInTheDocument();
  });

  // Kịch bản người dùng gặp thật: quay về từ VNPay mà phiên đã mất (thường vì
  // ReturnUrl khác origin với console nên localStorage rỗng). Trang phải vẫn kết
  // luận được bằng endpoint public, và nút quay lại vẫn trỏ về màn Gói cước —
  // KHÔNG đá sang /login, vì đăng nhập ở origin này cũng không đưa họ về đúng chỗ.
  it("still reports the result when the session is gone on return", async () => {
    localStorage.clear();
    vi.mocked(getVnPayReturnStatus).mockResolvedValue({
      vnPayTxnRef: "VR-SUBSCRIPTION-001",
      paymentId: "payment-1",
      referenceType: "SUBSCRIPTION",
      referenceId: "subscription-1",
      status: "SUCCEEDED",
    });

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00&vnp_TxnRef=VR-1"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.successTitle"),
    ).toBeInTheDocument();
    expect(getOperatorSubscription).not.toHaveBeenCalled();
    expect(screen.getByText("paymentReturn.signedOutNote")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "paymentReturn.backToPackages" }),
    ).toHaveAttribute("href", "/manager/packages");
  });

  it("falls back to the public status endpoint when the session expires mid-check", async () => {
    vi.mocked(getOperatorSubscription).mockRejectedValue(
      new ApiRequestError("Unauthorized", 401, "UNAUTHORIZED"),
    );
    vi.mocked(getVnPayReturnStatus).mockResolvedValue({
      vnPayTxnRef: "VR-SUBSCRIPTION-001",
      paymentId: "payment-1",
      referenceType: "SUBSCRIPTION",
      referenceId: "subscription-1",
      status: "SUCCEEDED",
    });

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00&vnp_TxnRef=VR-1"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.successTitle"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("paymentReturn.errorTitle"),
    ).not.toBeInTheDocument();
  });

  it("waits until the paid target plan is active before reporting success", async () => {
    vi.useFakeTimers();
    const starterPlan = {
      ...plan,
      planId: "plan-starter",
      name: "Starter",
    };
    saveSubscriptionPaymentIntent({
      paymentId: "payment-1",
      upgradeAttemptId: "attempt-1",
      targetPlanId: plan.planId,
      targetPlanName: plan.name,
    });
    vi.mocked(getOperatorSubscription)
      .mockResolvedValueOnce({ ...subscription, plan: starterPlan })
      .mockResolvedValue(subscription);

    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=00"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.queryByText("paymentReturn.successTitle"),
    ).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByText("paymentReturn.successTitle")).toBeInTheDocument();
    expect(getOperatorSubscription).toHaveBeenCalledTimes(2);
    expect(getSubscriptionPaymentIntent()).toBeNull();
  });
});
