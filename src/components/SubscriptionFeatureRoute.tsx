import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useOperatorSubscription,
  type SubscriptionModule,
} from "../contexts/operatorSubscriptionContext";

type SubscriptionFeatureRouteProps = {
  module: SubscriptionModule;
};

export default function SubscriptionFeatureRoute({
  module,
}: SubscriptionFeatureRouteProps) {
  const { t } = useTranslation("common");
  const { hasModule, isLoading } = useOperatorSubscription();

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">{t("pageLoading")}</div>;
  }

  if (!hasModule(module)) {
    return <Navigate to="/manager/packages" replace />;
  }

  return <Outlet />;
}
