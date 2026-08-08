import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
  const [user, setUser] = useState(getAuthUser);

  useEffect(() => {
    const syncAuthSession = () => setUser(getAuthUser());

    window.addEventListener("storage", syncAuthSession);
    return () => window.removeEventListener("storage", syncAuthSession);
  }, []);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
