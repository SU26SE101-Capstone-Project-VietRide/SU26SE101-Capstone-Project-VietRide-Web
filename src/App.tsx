import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import { lazy, Suspense } from "react";

const ManagerLayout = lazy(() => import("./layouts/ManagerLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Profile = lazy(() => import("./pages/Profile"));
const TripsList = lazy(() => import("./pages/Manager/Trips/index"));
const BookingsList = lazy(() => import("./pages/Manager/Bookings/index"));
const ParcelsList = lazy(() => import("./pages/Manager/Parcels/index"));
const StaffList = lazy(() => import("./pages/Manager/Staff/index"));
const VehiclesList = lazy(() => import("./pages/Manager/Vehicles/index"));
const RoutesList = lazy(() => import("./pages/Manager/Routes/index"));
const GPSTracking = lazy(() => import("./pages/Manager/GPS/index"));
const ShuttleTracking = lazy(() => import("./pages/Manager/ShuttleTracking/index"));
const Reports = lazy(() => import("./pages/Manager/Reports/index"));
const DispatchPanel = lazy(() => import("./pages/Manager/Dispatch/index"));
const ManagerWallet = lazy(() => import("./pages/Manager/Wallet/index"));
const RouteETA = lazy(() => import("./pages/Manager/RouteETA/index"));
const ManagerVouchers = lazy(() => import("./pages/Manager/Vouchers/index"));
const ManagerPackages = lazy(() => import("./pages/Manager/Packages/index"));
const SubscriptionPaymentReturn = lazy(() => import("./pages/Manager/Packages/PaymentReturn"));
const ManagerPolicies = lazy(() => import("./pages/Manager/Policies/index"));
const ManagerSettings = lazy(() => import("./pages/Manager/Settings/index"));
const ManagerCapacity = lazy(() => import("./pages/Manager/Capacity/index"));
const VehicleBuilderPage = lazy(() =>
  import("./modules/vehicle-builder").then((module) => ({ default: module.VehicleBuilderPage })),
);
const Operators = lazy(() => import("./pages/Admin/Operators"));
const Users = lazy(() => import("./pages/Admin/Users"));
const Vouchers = lazy(() => import("./pages/Admin/Vouchers"));
const Packages = lazy(() => import("./pages/Admin/Packages"));
const Revenue = lazy(() => import("./pages/Admin/Revenue"));
const AdminReports = lazy(() => import("./pages/Admin/Reports"));
const OutboxDlq = lazy(() => import("./pages/Admin/OutboxDlq"));
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
const ManagerDashboard = lazy(() => import("./pages/Manager/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const PrivateRoute = lazy(() => import("./components/PrivateRoute"));
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Đang tải trang...</div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/success" element={<RegisterSuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/set-initial-password" element={<SetInitialPassword />} />
        <Route path="/auth/set-password" element={<SetInitialPassword />} />
        <Route path="/auth/set-initial-password" element={<SetInitialPassword />} />

        {/* VNPay redirects the operator's browser to this result page. */}
        <Route element={<PrivateRoute allowedRoles={["OPERATOR_ADMIN"]} />}>
          <Route
            path="/payments/return"
            element={<SubscriptionPaymentReturn />}
          />
        </Route>

        {/* Manager routes */}
        <Route
          element={
            <PrivateRoute allowedRoles={["OPERATOR_ADMIN", "OPERATOR_STAFF"]} />
          }
        >
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="trips" element={<TripsList />} />
            <Route path="route-eta" element={<RouteETA />} />
            <Route path="routes" element={<RoutesList />} />
            <Route
              path="route-extensions"
              element={<Navigate to="/manager/route-eta" replace />}
            />
            <Route path="vehicles" element={<VehiclesList />} />
            <Route path="bookings" element={<BookingsList />} />
            <Route path="parcels" element={<ParcelsList />} />
            <Route path="gps" element={<GPSTracking />} />
            <Route path="shuttle-tracking" element={<ShuttleTracking />} />
            <Route path="dispatch" element={<DispatchPanel />} />
            <Route path="profile" element={<Profile />} />
            <Route path="vouchers" element={<ManagerVouchers />} />
            <Route path="wallet" element={<ManagerWallet />} />
            <Route path="reports" element={<Reports />} />
            <Route path="assistant" element={<RagAssistant />} />
            <Route
              element={<PrivateRoute allowedRoles={["OPERATOR_ADMIN"]} />}
            >
              <Route path="vehicle-builder" element={<VehicleBuilderPage />} />
              <Route path="staff" element={<StaffList />} />
              <Route path="capacity" element={<ManagerCapacity />} />
              <Route path="packages" element={<ManagerPackages />} />
              <Route path="policies" element={<ManagerPolicies />} />
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
            <Route path="revenue" element={<Revenue />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="outbox-dlq" element={<OutboxDlq />} />
            <Route
              path="payouts"
              element={
                <Navigate to="/admin/wallet-settlement?tab=settlements&filter=needs-attention" replace />
              }
            />
            <Route path="wallet-settlement" element={<WalletSettlement />} />
            <Route path="rag-audit" element={<RagAudit />} />
            <Route path="assistant" element={<RagAssistant />} />
            <Route path="policies" element={<AdminPolicies />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
