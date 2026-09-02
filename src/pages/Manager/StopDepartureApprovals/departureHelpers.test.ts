import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  departureApprovalTone,
  departureErrorTranslationKey,
} from "./departureHelpers";

describe("departureErrorTranslationKey", () => {
  it("không đưa message lỗi kỹ thuật thô ra màn nhà xe", () => {
    expect(
      departureErrorTranslationKey(
        new ApiRequestError("Internal server error", 500, "INTERNAL_ERROR"),
        "stopDepartureApprovals.loadFailed",
      ),
    ).toBe("stopDepartureApprovals.errors.systemUnavailable");
  });
});

describe("departureApprovalTone", () => {
  it("chỉ tô thành công khi đã cho rời bến", () => {
    expect(departureApprovalTone("APPROVED")).toBe("success");
    expect(departureApprovalTone("PENDING_APPROVAL")).toBe("warning");
    expect(departureApprovalTone("REJECTED")).toBe("warning");
  });
});
