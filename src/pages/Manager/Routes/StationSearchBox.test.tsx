import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchStations, type Station } from "../../../api/vietride";
import StationSearchBox from "./StationSearchBox";

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;

  return {
    useTranslation: () => ({ t: translate }),
  };
});

vi.mock("../../../api/vietride", () => ({
  searchStations: vi.fn(),
}));

const station = {
  id: "station-page-8",
  name: "Bến xe Miền Đông mới",
  city: "Thành phố Hồ Chí Minh",
  ward: "Phường Long Bình",
  latitude: 10.877,
  longitude: 106.814,
} satisfies Station;

describe("StationSearchBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchStations).mockResolvedValue([station]);
  });

  it("searches the platform instead of relying on a preloaded page", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onSelect = vi.fn();

    render(
      <StationSearchBox
        selectedStation={null}
        onClear={onClear}
        onSelect={onSelect}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "routes.searchStations" }),
      "Miền Đông",
    );

    await waitFor(() =>
      expect(searchStations).toHaveBeenCalledWith({ q: "Miền Đông" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Bến xe Miền Đông mới/ }),
    );

    expect(onSelect).toHaveBeenCalledWith(station);
    expect(
      screen.getByRole("textbox", { name: "routes.searchStations" }),
    ).toHaveValue(station.name);
  });
});
