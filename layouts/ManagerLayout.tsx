import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getAuthUser } from "../auth";
import AssistantBubble from "../components/AssistantBubble";
import { OperatorSubscriptionProvider } from "../contexts/OperatorSubscriptionProvider";
import { useOperatorSubscription } from "../contexts/operatorSubscriptionContext";

function ManagerLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation(["nav", "common"]);
  const { isLoading } = useOperatorSubscription();
  const authUser = getAuthUser();
  const role =
    authUser?.role === "OPERATOR_ADMIN" ? "OPERATOR_ADMIN" : "OPERATOR_STAFF";

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden bg-white">
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={t("layout.managerDashboard")}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-gray-50">
          <div className="min-w-0 p-6">
            {isLoading ? (
              <p className="text-sm text-gray-500">
                {t("common:pageLoading")}
              </p>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
      <AssistantBubble />
    </div>
  );
}

export default function ManagerLayout() {
  const authUser = getAuthUser();
  const role =
    authUser?.role === "OPERATOR_ADMIN" ? "OPERATOR_ADMIN" : "OPERATOR_STAFF";

  return (
    <OperatorSubscriptionProvider role={role}>
      <ManagerLayoutContent />
    </OperatorSubscriptionProvider>
  );
}
