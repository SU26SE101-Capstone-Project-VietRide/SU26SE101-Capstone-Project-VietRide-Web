import { describe, expect, it } from "vitest";
import enAdmin from "./en/admin.json";
import viAdmin from "./vi/admin.json";

describe("admin wallet transaction translations", () => {
  it("translates subscription payments in both supported languages", () => {
    expect(
      viAdmin.walletSettlement.references.SUBSCRIPTION_PAYMENT,
    ).toBe("Thanh toán gói dịch vụ");
    expect(
      enAdmin.walletSettlement.references.SUBSCRIPTION_PAYMENT,
    ).toBe("Subscription payment");
  });
});
