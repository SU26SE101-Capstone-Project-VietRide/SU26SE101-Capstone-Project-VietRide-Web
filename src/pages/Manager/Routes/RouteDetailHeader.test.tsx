// Nút lưu phải đứng CÙNG MỘT CHỖ ở cả ba tab. Trước đây tab "Tuyến thay thế" bị
// loại khỏi header và tự dựng nút riêng trong thanh công cụ bản đồ, nên đổi tab
// là nút lưu nhảy sang chỗ khác — người dùng phải đi tìm.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RouteDetailHeader from "./RouteDetailHeader";
import type { RouteTab } from "./routeFormUtils";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderHeader(
  activeTab: RouteTab,
  overrides: Partial<{
    isDirty: boolean;
    isAlternativeDirty: boolean;
    onSaveRoute: () => void;
    onSaveAlternative: () => void;
  }> = {},
) {
  const onSaveRoute = overrides.onSaveRoute ?? vi.fn();
  const onSaveAlternative = overrides.onSaveAlternative ?? vi.fn();

  render(
    <RouteDetailHeader
      routeName="HCM-DN 1"
      activeTab={activeTab}
      onSelectTab={vi.fn()}
      onOpenStationManagement={vi.fn()}
      canManageRoutes
      isDirty={overrides.isDirty ?? false}
      isSaving={false}
      onSaveRoute={onSaveRoute}
      isAlternativeDirty={overrides.isAlternativeDirty ?? false}
      isSavingAlternative={false}
      onSaveAlternative={onSaveAlternative}
    />,
  );

  return { onSaveRoute, onSaveAlternative };
}

describe("RouteDetailHeader — nút lưu", () => {
  it.each<[RouteTab, string]>([
    ["info", "routes.saveRoute"],
    ["stops", "routes.saveRoute"],
    ["alternatives", "routes.saveAlternative"],
  ])("hiện đúng một nút lưu ở tab %s", (tab, label) => {
    renderHeader(tab);

    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    // Đúng MỘT nút lưu — không phải hai nút cùng nhãn cạnh nhau
    expect(
      screen
        .getAllByRole("button")
        .filter((button) =>
          /routes\.(saveRoute|saveAlternative)/.test(button.textContent ?? ""),
        ),
    ).toHaveLength(1);
  });

  // Nhãn phải nói rõ nó lưu CÁI GÌ: tuyến chính và tuyến thay thế là hai bản
  // ghi khác nhau, dùng chung một chữ "Lưu tuyến" là đánh lừa người dùng.
  it("không dùng nhãn của tuyến chính cho tab tuyến thay thế", () => {
    renderHeader("alternatives");

    expect(
      screen.queryByRole("button", { name: "routes.saveRoute" }),
    ).not.toBeInTheDocument();
  });

  it("badge chưa lưu bám theo trạng thái của ĐÚNG tab đang mở", () => {
    renderHeader("alternatives", { isDirty: true, isAlternativeDirty: false });

    // Tuyến chính bẩn nhưng tab thay thế thì sạch → không được báo chưa lưu
    expect(screen.queryByText("routes.unsavedChanges")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "routes.saveAlternative" }),
    ).toBeDisabled();
  });

  it("bật nút khi chính tab đang mở có thay đổi chưa lưu", () => {
    renderHeader("alternatives", { isDirty: false, isAlternativeDirty: true });

    expect(screen.getByText("routes.unsavedChanges")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "routes.saveAlternative" }),
    ).toBeEnabled();
  });
});
