import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Pages

import ManagerLayout from "./layouts/ManagerLayout";
import AdminLayout from "./layouts/AdminLayout";
import Profile from "./pages/Profile";

// Manager Pages

import TripsList from "./pages/Manager/Trips/index";
import BookingsList from "./pages/Manager/Bookings/index";
import ParcelsList from "./pages/Manager/Parcels/index";
import StaffList from "./pages/Manager/Staff/index";
import VehiclesList from "./pages/Manager/Vehicles/index";
import RoutesList from "./pages/Manager/Routes/index";
import GPSTracking from "./pages/Manager/GPS/index";
import Reports from "./pages/Manager/Reports/index";
import DispatchPanel from "./pages/Manager/Dispatch/index";
import ManagerWallet from "./pages/Manager/Wallet/index";
import RouteETA from "./pages/Manager/RouteETA/index";
import ManagerVouchers from "./pages/Manager/Vouchers/index";
import ManagerPackages from "./pages/Manager/Packages/index";
import ManagerPolicies from "./pages/Manager/Policies/index";
import ManagerSettings from "./pages/Manager/Settings/index";
import { VehicleBuilderPage } from "./modules/vehicle-builder";

// Admin Pages

import Operators from "./pages/Admin/Operators";
import Users from "./pages/Admin/Users";
import Vouchers from "./pages/Admin/Vouchers";
import Packages from "./pages/Admin/Packages";
import Revenue from "./pages/Admin/Revenue";
import AdminReports from "./pages/Admin/Reports";
import Payouts from "./pages/Admin/Payouts";
import AdminPolicies from "./pages/Admin/Policies";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/Manager/Dashboard";
import AdminDashboard from "./pages/Admin/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Manager routes */}
        <Route path="/manager" element={<ManagerLayout />}>
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="trips" element={<TripsList />} />
          <Route path="route-eta" element={<RouteETA />} />
          <Route path="routes" element={<RoutesList />} />
          <Route path="vehicles" element={<VehiclesList />} />
          <Route path="vehicle-builder" element={<VehicleBuilderPage />} />
          <Route path="staff" element={<StaffList />} />
          <Route path="bookings" element={<BookingsList />} />
          <Route path="parcels" element={<ParcelsList />} />
          <Route path="vouchers" element={<ManagerVouchers />} />
          <Route path="packages" element={<ManagerPackages />} />
          <Route path="policies" element={<ManagerPolicies />} />
          <Route path="gps" element={<GPSTracking />} />
          <Route path="reports" element={<Reports />} />
          <Route path="dispatch" element={<DispatchPanel />} />
          <Route path="wallet" element={<ManagerWallet />} />
          <Route path="settings" element={<ManagerSettings />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="operators" element={<Operators />} />
          <Route path="users" element={<Users />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="packages" element={<Packages />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="policies" element={<AdminPolicies />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
