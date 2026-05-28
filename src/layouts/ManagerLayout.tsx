import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function ManagerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        role="manager"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName="Dashboard Quản lý"
          unreadNotifications={5}
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
