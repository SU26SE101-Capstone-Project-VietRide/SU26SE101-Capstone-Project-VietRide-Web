import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./App.css";

import { lazy, Suspense } from "react";

import ToastProvider from "./components/toast/ToastProvider";
import EntryRedirect from "./components/EntryRedirect";

const ManagerLayout = lazy(() => import("./layouts/ManagerLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Profile = lazy(() => import("./pages/Profile"));
const TripsList = lazy(() => import("./pages/Manager/Trips/index"));
const BookingsList = lazy(() => import("./pages/Manager/Bookings/index"));
const ParcelsList = lazy(() => import("./pages/Manager/Parcels/index"));
const StaffList = lazy(() => import("./pages/Manager/Staff/index"));
const VehiclesList = lazy(() => import("./pages/Manager/Vehicles/index"));
const RoutesList = lazy(() => import("./pages/Manager/Routes/index"));
const OperationsCenter = lazy(() => import("./pages/Manager/Operations/index"));
const DispatchPanel = lazy(() => import("./pages/Manager/Dispatch/index"));
const ManagerIncidents = lazy(() => import("./pages/Manager/Incidents/index"));
const ManagerWallet = lazy(() => import("./pages/Manager/Wallet/index"));
const ManagerVouchers = lazy(() => import("./pages/Manager/Vouchers/index"));
const ManagerPackages = lazy(() => import("./pages/Manager/Packages/index"));
const SubscriptionPaymentReturn = lazy(
  () => import("./pages/Manager/Packages/PaymentReturn"),
);
const ManagerPolicies = lazy(() => import("./pages/Manager/Policies/index"));
const ManagerSettings = lazy(() => import("./pages/Manager/Settings/index"));
const VehicleBuilderPage = lazy(() =>
  import("./modules/vehicle-builder").then((module) => ({
    default: module.VehicleBuilderPage,
  })),
);
const Operators = lazy(() => import("./pages/Admin/Operators"));
const Users = lazy(() => import("./pages/Admin/Users"));
const Vouchers = lazy(() => import("./pages/Admin/Vouchers"));
const Packages = lazy(() => import("./pages/Admin/Packages"));
const AdminReports = lazy(() => import("./pages/Admin/Reports"));
const AdminPolicies = lazy(() => import("./pages/Admin/Policies"));
const AdminStations = lazy(() => import("./pages/Admin/Stations"));
const AdminLocations = lazy(() => import("./pages/Admin/Locations"));
const WalletSettlement = lazy(() => import("./pages/Admin/WalletSettlement"));
const RagAudit = lazy(() => import("./pages/Admin/RagAudit"));
const RagAssistant = lazy(() => import("./pages/RagAssistant"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const RegisterSuccess = lazy(() => import("./pages/RegisterSuccess"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const SetInitialPassword = lazy(() => import("./pages/SetInitialPassword"));
/** Public guest live map — capability link only (no auth layout). */
const TripSharingPage = lazy(() => import("./pages/TripSharing/index"));
const ManagerDashboard = lazy(() => import("./pages/Manager/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const PrivateRoute = lazy(() => import("./components/PrivateRoute"));
const SubscriptionFeatureRoute = lazy(
  () => import("./components/SubscriptionFeatureRoute"),
);
export default function App() {
  const { t } = useTranslation("common");

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-gray-500">{t("pageLoading")}</div>
        }
      >
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/success" element={<RegisterSuccess />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/set-initial-password"
              element={<SetInitialPassword />}
            />
            <Route path="/auth/set-password" element={<SetInitialPassword />} />
            <Route
              path="/auth/set-initial-password"
              element={<SetInitialPassword />}
            />
            {/* Passenger trip-share invite (BE shareUrl path). Token only in #hash. */}
            <Route path="/trip-sharing" element={<TripSharingPage />} />

            {/*
              VNPay redirects the operator's browser to this result page.
              Route PUBLIC có chủ đích: người dùng quay lại sau vài phút ở cổng
              VNPay, phiên có thể đã hết/không còn trong localStorage (đổi
              trình duyệt, mở từ app ngân hàng, refresh token bị revoke...).
              Nếu bọc PrivateRoute thì họ bị đá về /login và MẤT LUÔN query
              `vnp_*` — không còn cách nào xem lại kết quả giao dịch.
              Endpoint xác minh `/v1/payments/vnpay-return-status` là
              [AllowAnonymous], chính chữ ký VNPay trong query xác thực request,
              nên trang này không cần token để kết luận.
            */}
            <Route
              path="/payments/return"
              element={<SubscriptionPaymentReturn />}
            />

            {/* Manager routes */}
            <Route
              element={
                <PrivateRoute
                  allowedRoles={["OPERATOR_ADMIN", "OPERATOR_STAFF"]}
                />
              }
            >
              <Route path="/manager" element={<ManagerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ManagerDashboard />} />
                <Route path="trips" element={<TripsList />} />
                <Route path="routes" element={<RoutesList />} />
                <Route path="vehicles" element={<VehiclesList />} />
                {/* Màn Capacity cũ đã gộp vào màn Vehicles */}
                <Route
                  path="capacity"
                  element={<Navigate to="/manager/vehicles" replace />}
                />
                <Route path="bookings" element={<BookingsList />} />
                <Route
                  element={
                    <SubscriptionFeatureRoute module="enableParcel" />
                  }
                >
                  <Route path="parcels" element={<ParcelsList />} />
                </Route>
                <Route path="operations" element={<OperationsCenter />} />
                <Route
                  path="gps"
                  element={<Navigate to="/manager/operations" replace />}
                />
                <Route
                  element={
                    <SubscriptionFeatureRoute module="enableShuttle" />
                  }
                >
                  <Route
                    path="shuttle-tracking"
                    element={<Navigate to="/manager/dispatch" replace />}
                  />
                  <Route path="dispatch" element={<DispatchPanel />} />
                </Route>
                <Route path="incidents" element={<ManagerIncidents />} />
                <Route path="profile" element={<Profile />} />
                <Route path="vouchers" element={<ManagerVouchers />} />
                <Route path="wallet" element={<ManagerWallet />} />
                <Route
                  path="reports"
                  element={<Navigate to="/manager/dashboard" replace />}
                />
                <Route
                  element={<SubscriptionFeatureRoute module="enableRag" />}
                >
                  <Route path="assistant" element={<RagAssistant />} />
                </Route>
                <Route
                  element={<PrivateRoute allowedRoles={["OPERATOR_ADMIN"]} />}
                >
                  {/* Màn RouteETA cũ đã gộp vào Trung tâm vận hành (panel đề xuất lộ trình) */}
                  <Route
                    path="route-eta"
                    element={
                      <Navigate
                        to="/manager/operations?panel=proposals"
                        replace
                      />
                    }
                  />

                  <Route
                    path="route-extensions"
                    element={
                      <Navigate
                        to="/manager/operations?panel=proposals"
                        replace
                      />
                    }
                  />

                  <Route
                    path="vehicle-builder"
                    element={<VehicleBuilderPage />}
                  />
                  <Route path="staff" element={<StaffList />} />
                  <Route
                    path="capacity"
                    element={<Navigate to="/manager/vehicles" replace />}
                  />
                  <Route path="packages" element={<ManagerPackages />} />
                  <Route
                    element={<SubscriptionFeatureRoute module="enableRag" />}
                  >
                    <Route path="policies" element={<ManagerPolicies />} />
                  </Route>
                  <Route path="settings" element={<ManagerSettings />} />
                </Route>
              </Route>
            </Route>

            {/* Admin routes */}
            <Route element={<PrivateRoute allowedRoles={["SYSTEM_ADMIN"]} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="operators" element={<Operators />} />
                <Route path="stations" element={<AdminStations />} />
                <Route path="locations" element={<AdminLocations />} />
                <Route path="users" element={<Users />} />
                <Route path="vouchers" element={<Vouchers />} />
                <Route path="packages" element={<Packages />} />
                <Route path="reports" element={<AdminReports />} />

                <Route
                  path="payouts"
                  element={
                    <Navigate
                      to="/admin/wallet-settlement?tab=settlements&filter=needs-attention"
                      replace
                    />
                  }
                />
                <Route
                  path="wallet-settlement"
                  element={<WalletSettlement />}
                />
                <Route path="rag-audit" element={<RagAudit />} />
                <Route path="assistant" element={<RagAssistant />} />
                <Route path="policies" element={<AdminPolicies />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<EntryRedirect />} />
            <Route path="*" element={<EntryRedirect />} />
          </Routes>
        </ToastProvider>
      </Suspense>
    </BrowserRouter>
  );
}
