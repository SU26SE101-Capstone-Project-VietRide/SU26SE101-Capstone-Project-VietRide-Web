import { describe, expect, it } from "vitest";
import { emptyForm, toCreateRequest, toUpdateRequest } from "./voucherHelpers";

const form = {
  ...emptyForm,
  name: "Summer voucher",
  discount: "20",
  expiryDate: "31/12/2030",
};

describe("admin voucher request mapping", () => {
  it("lets the backend apply hidden constraint defaults on create", () => {
    const request = toCreateRequest(form);

    expect(request).not.toHaveProperty("newUserOnly");
    expect(request).not.toHaveProperty("applicablePaymentMethods");
    expect(request).not.toHaveProperty("applicableRouteIds");
  });

  it("does not overwrite hidden backend constraints on update", () => {
    const request = toUpdateRequest(form);

    expect(request).not.toHaveProperty("newUserOnly");
    expect(request).not.toHaveProperty("applicablePaymentMethods");
    expect(request).not.toHaveProperty("applicableRouteIds");
    expect(request).toEqual(
      expect.objectContaining({
        name: "Summer voucher",
        value: 20,
        applicableServices: ["BOOKING", "PARCEL"],
      }),
    );
  });
});
