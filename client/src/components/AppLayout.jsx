import { Link, NavLink } from "react-router-dom";
import { clearToken } from "../lib/auth";

export default function AppLayout({ title, subtitle, user, onLogout, children }) {
  function handleLogout() {
    clearToken();
    if (onLogout) {
      onLogout();
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to={user?.role === "author" ? "/author/dashboard" : "/courses"}>
          Web Trainer Platform
        </Link>

        <nav className="topnav">
          <NavLink to="/courses">Courses</NavLink>
          {user?.role === "author" ? <NavLink to="/author/dashboard">Author</NavLink> : null}
          {user ? <NavLink to="/dashboard">Dashboard</NavLink> : null}
          {user ? (
            <button type="button" className="link-button" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <NavLink to="/login">Login</NavLink>
          )}
        </nav>
      </header>

      <main className="page-shell">
        <section className="page-hero">
          <h1>{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </section>
        {children}
      </main>
    </div>
  );
}
