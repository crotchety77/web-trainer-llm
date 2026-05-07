import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { getApiUrl, apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, error } = useAuthUser({ required: true });
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  useEffect(() => {
    if (user?.role === "student") {
      setLoadingEnrollments(true);
      apiRequest("/api/student/courses", { headers: getAuthHeaders() })
        .then(data => setEnrollments(data.enrollments || []))
        .catch(err => console.error("Failed to load enrollments:", err))
        .finally(() => setLoadingEnrollments(false));
    }
  }, [user]);

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
          <>
            <div className="action-row">
              <Link className="primary-link-button" to="/courses">
                Browse Courses
              </Link>
            </div>
            
            <div style={{ marginTop: "2.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>Мой прогресс обучения</h3>
              {loadingEnrollments ? (
                <p className="helper-text">Загрузка ваших курсов...</p>
              ) : enrollments.length > 0 ? (
                <div className="course-list">
                  {enrollments.map(course => {
                    const percentage = course.total_blocks > 0 ? Math.round((course.completed_blocks / course.total_blocks) * 100) : 0;
                    return (
                      <article key={course.id} className="course-card compact" style={{ display: 'block', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0 }}>{course.title}</h4>
                          <span style={{ fontWeight: 'bold', color: '#0b63f6' }}>{percentage}%</span>
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', width: '100%', overflow: 'hidden', marginBottom: '1.5rem' }}>
                          <div style={{ background: '#0b63f6', height: '100%', width: `${percentage}%`, transition: 'width 0.3s ease' }}></div>
                        </div>
                        <div className="meta-row" style={{ justifyContent: 'space-between' }}>
                          <span className="helper-text" style={{ fontSize: '0.85rem' }}>
                            Выполнено: {course.completed_blocks} из {course.total_blocks}
                          </span>
                          <Link className="secondary-button" style={{ padding: '8px 14px', fontSize: '0.85rem' }} to={`/courses/${course.id}`}>
                            Продолжить
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="helper-text">Вы еще не записались ни на один курс.</p>
              )}
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
