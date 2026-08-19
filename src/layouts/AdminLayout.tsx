import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { menuLabelKeyFor } from "../components/sidebarMenu";
import Topbar from "../components/Topbar";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import AssistantBubble from "../components/AssistantBubble";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation(["nav", "common"]);
  const { pathname } = useLocation();
  const labelKey = menuLabelKeyFor("SYSTEM_ADMIN", pathname);
  useDocumentTitle(labelKey ? t(labelKey) : null, t("common:brand"));

  return (
    <div className="flex h-screen bg-white">
      {/* Phần tử focus ĐẦU TIÊN của trang. Không có nó, người dùng bàn phím
          phải Tab qua toàn bộ menu trước khi tới được nội dung. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-vr-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t("common:skipToContent")}
      </a>
      <Sidebar
        role="SYSTEM_ADMIN"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={t("layout.adminDashboard")}
        />

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto bg-white">
          {/* Giới hạn bề rộng: không có nó, trên màn 2560px bảng giãn tới
              ~2280px và mắt phải quét ngang rất xa. */}
          <div className="mx-auto max-w-[1440px] p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <AssistantBubble />
    </div>
  );
}
