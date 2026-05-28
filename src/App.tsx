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

// Admin Pages

import Operators from "./pages/Admin/Operators";
import Users from "./pages/Admin/Users";
import Vouchers from "./pages/Admin/Vouchers";
import Revenue from "./pages/Admin/Revenue";
import AdminReports from "./pages/Admin/Reports";
import AdminSettings from "./pages/Admin/Settings";
import Payouts from "./pages/Admin/Payouts";
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
          <Route path="staff" element={<StaffList />} />
          <Route path="bookings" element={<BookingsList />} />
          <Route path="parcels" element={<ParcelsList />} />

          <Route path="gps" element={<GPSTracking />} />
          <Route path="reports" element={<Reports />} />
          <Route path="dispatch" element={<DispatchPanel />} />
          <Route path="wallet" element={<ManagerWallet />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="operators" element={<Operators />} />
          <Route path="users" element={<Users />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
