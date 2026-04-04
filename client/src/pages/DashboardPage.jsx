import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { getApiUrl } from "../lib/api";
import { clearToken } from "../lib/auth";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, error } = useAuthUser({ required: true });

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  if (loading) {
    return <main className="centered-state">Loading profile...</main>;
  }

  return (
    <AppLayout
      title="Dashboard"
      subtitle="JWT auth is active. Use this page as the role-based entry point."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        {error ? (
          <div>
            <p className="error">{error}</p>
            <p className="helper-text">
              Token is missing or invalid. <Link to="/login">Login again</Link>.
            </p>
          </div>
        ) : null}

        {user ? (
          <div className="profile-grid">
            <div>
              <span className="profile-label">Name</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span className="profile-label">Email</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span className="profile-label">Role</span>
              <strong>{user.role}</strong>
            </div>
            <div>
              <span className="profile-label">API</span>
              <strong>{getApiUrl()}</strong>
            </div>
          </div>
        ) : null}

        {user?.role === "author" ? (
          <div className="action-row">
            <Link className="primary-link-button" to="/author/dashboard">
              Go to Author Dashboard
            </Link>
            <Link className="secondary-link-button" to="/courses">
              View Published Courses
            </Link>
          </div>
        ) : (
          <div className="action-row">
            <Link className="primary-link-button" to="/courses">
              Browse Courses
            </Link>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
