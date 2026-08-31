import { describe, expect, it } from "vitest";
import { emptyForm, toCreateRequest, toUpdateRequest } from "./voucherHelpers";

const form = {
  ...emptyForm,
  code: "VIETRIDEXNICHAO",
  name: "Summer voucher",
  discount: "20",
  expiryDate: "2030-12-31T18:45",
};

describe("admin voucher request mapping", () => {
  it("lets the backend apply hidden constraint defaults on create", () => {
    const request = toCreateRequest(form);

    expect(request).not.toHaveProperty("newUserOnly");
    expect(request).not.toHaveProperty("applicablePaymentMethods");
    expect(request).not.toHaveProperty("applicableRouteIds");
    expect(request).toEqual(
      expect.objectContaining({
        code: "VIETRIDEXNICHAO",
        fundingType: "VIETRIDE_FUNDED",
        applicableOperatorIds: null,
      }),
    );
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

  it("sends the Admin voucher expiry time selected by the user", () => {
    const request = toCreateRequest(form);
    const expected = new Date(2030, 11, 31, 18, 45).toISOString();

    expect(request.validUntil).toBe(expected);
  });
