import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../lib/auth";
import { useAuthUser } from "../hooks/useAuthUser";

export default function ProtectedRoute({ roles, children }) {
  const location = useLocation();
  const token = getToken();
  const { user, loading, error } = useAuthUser({ required: true });

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (loading) {
    return <main className="centered-state">Loading profile...</main>;
  }

  if (error || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin/users" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
