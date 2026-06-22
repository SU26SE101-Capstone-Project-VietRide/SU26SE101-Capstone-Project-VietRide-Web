import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  getAuthUser,
  getHomePathForRole,
  type AuthRole,
} from "../auth";

type PrivateRouteProps = {
  allowedRoles: AuthRole[];
};

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const location = useLocation();
  const user = getAuthUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
