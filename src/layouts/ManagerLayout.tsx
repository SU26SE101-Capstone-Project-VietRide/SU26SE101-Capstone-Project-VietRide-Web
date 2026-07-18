import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getAuthUser } from "../auth";

export default function ManagerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation("nav");
  const authUser = getAuthUser();
  const role =
    authUser?.role === "OPERATOR_ADMIN" ? "OPERATOR_ADMIN" : "OPERATOR_STAFF";

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={t("layout.managerDashboard")}
        />

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
