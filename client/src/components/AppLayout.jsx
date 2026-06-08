import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { clearToken } from "../lib/auth";

export default function AppLayout({ title, subtitle, user, onLogout, children, heroLink }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  const homePath =
    user?.role === "admin"
      ? "/admin/users"
      : user?.role === "author"
        ? "/author/dashboard"
        : "/courses";

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  function handleLogout() {
    clearToken();
    closeMobileNav();
    if (onLogout) {
      onLogout();
    }
  }

  function renderNavContent() {
    return (
      <>
      <NavLink to="/courses" onClick={closeMobileNav}>Все курсы</NavLink>
      {user?.role === "author" ? <NavLink to="/author/dashboard" onClick={closeMobileNav}>Панель автора</NavLink> : null}
      {user?.role === "admin" ? <NavLink to="/admin/users" onClick={closeMobileNav}>Панель админа</NavLink> : null}
      {user ? <NavLink to="/dashboard" onClick={closeMobileNav}>Профиль</NavLink> : null}
      {user ? (
        <button type="button" className="link-button" onClick={handleLogout}>
          Выйти
        </button>
      ) : (
        <NavLink to="/login" onClick={closeMobileNav}>Войти</NavLink>
      )}
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to={homePath} onClick={closeMobileNav}>
          Web Trainer Platform
        </Link>

        <nav className="topnav">
          {renderNavContent()}
        </nav>

        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label={isMobileNavOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMobileNavOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <div
        className={`mobile-nav-backdrop ${isMobileNavOpen ? "open" : ""}`}
        onClick={closeMobileNav}
        aria-hidden="true"
      />
      <aside
        id="mobile-navigation"
        className={`mobile-nav-drawer ${isMobileNavOpen ? "open" : ""}`}
        aria-label="Мобильная навигация"
        aria-hidden={!isMobileNavOpen}
      >
        <div className="mobile-nav-header">
          <strong>Web Trainer Platform</strong>
          <button type="button" className="mobile-nav-close" onClick={closeMobileNav} aria-label="Закрыть меню">
            ×
          </button>
        </div>
        <nav className="mobile-nav-links">
          {renderNavContent()}
        </nav>
      </aside>

      <main className="page-shell">
        {title || subtitle ? (
          <section className="page-hero">
            {title ? (
              heroLink ? (
                <h1>
                  <Link to={heroLink} className="hero-link">
                    {title}
                  </Link>
                </h1>
              ) : (
                <h1>{title}</h1>
              )
            ) : null}
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </section>
        ) : null}
        {children}
      </main>
    </div>
  );
}
