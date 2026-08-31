import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import SharedTripReplacementNotice from "./SharedTripReplacementNotice";

describe("SharedTripReplacementNotice", () => {
  let originalLanguage: string;

  beforeAll(async () => {
    originalLanguage = i18n.language;
    await i18n.changeLanguage("vi");
  });

  afterAll(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("explains that the old position is retained and tracking resumes automatically", () => {
    render(<SharedTripReplacementNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Chuyến xe đang được đổi phương tiện",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Theo dõi sẽ tự tiếp tục",
    );
  });
});
