import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AssistantBubble from "../components/AssistantBubble";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("nav");

  return (
    <div className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-white">
      <Sidebar
        role="SYSTEM_ADMIN"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={t("layout.adminDashboard")}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-white">
          <div className="min-w-0 p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <AssistantBubble />
    </div>
  );
}
