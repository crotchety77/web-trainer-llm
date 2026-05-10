import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuthUser();
  const toast = useToast();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);

      try {
        const data = await apiRequest(`/api/courses/${id}`, {
          headers: getAuthHeaders()
        });
        if (!cancelled) {
          setCourse(data.course);
        }
      } catch (requestError) {
        if (!cancelled) {
          toast.error("Не удалось загрузить курс");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function handleEnroll() {
    try {
      await apiRequest(`/api/courses/${id}/enroll`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      toast.success("Вы записались на курс");
      setCourse((current) => (current ? { ...current, is_enrolled: true } : current));
    } catch (requestError) {
      toast.error("Не удалось записаться на курс");
    }
  }

  return (
    <AppLayout
      title={course?.title || "Course"}
      user={user}
      onLogout={handleLogout}
    >
      <section className="course-detail-section">
        {loading ? <p>Loading course...</p> : null}

        {course ? (
          <div className="detail-grid">
            <div className="detail-main panel">
              {course.cover_image_url ? (
                <img className="hero-cover" src={course.cover_image_url} alt={course.title} />
              ) : null}

              <div className="tag-row">
                {(course.tags_json || []).map((item) => (
                  <span key={item} className="tag-chip">
                    {item}
                  </span>
                ))}
              </div>

              <h2>{course.title}</h2>
              <p className="lead">{course.short_description}</p>
              <p>{course.intro_content}</p>

              {user?.role === "student" ? (
                <div className="action-row">
                  <button
                    type="button"
                    className="primary-link-button"
                    onClick={handleEnroll}
                    disabled={course.is_enrolled}
                    style={course.is_enrolled ? { opacity: 0.7, cursor: "not-allowed" } : { cursor: "pointer" }}
                  >
                    {course.is_enrolled ? "Вы записаны" : "Записаться на курс"}
                  </button>
                  {course.is_enrolled && course.lessons?.[0] ? (
                    <Link
                      className="secondary-link-button"
                      to={`/learn/${course.id}/${course.lessons[0].id}`}
                    >
                      Продолжить обучение
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <aside className="sidebar-panel">
              <h3>Lessons</h3>
              <div className="stack-list">
                {(course.lessons || []).map((lesson, index) => {
                  const displayPosition = index + 1;
                  // Разрешаем доступ авторам или студентам, которые уже записались
                  const canAccess = user && (user.role === "author" || course.is_enrolled);
                  
                  return canAccess ? (
                    <Link
                      key={lesson.id}
                      className="lesson-link-card"
                      to={`/learn/${course.id}/${lesson.id}`}
                    >
                      <span className="lesson-number">{displayPosition}</span>
                      <strong>
                        {lesson.title}
                      </strong>
                    </Link>
                  ) : (
                    <div
                      key={lesson.id}
                      className="lesson-link-card"
                      style={{ opacity: 0.7, cursor: "not-allowed" }}
                      title={user ? "Сначала запишитесь на курс" : "Log in to access lesson"}
                    >
                      <span className="lesson-number">{displayPosition}</span>
                      <strong>
                        {lesson.title}
                      </strong>
                    </div>
                  );
                })}
              </div>
              {!user && (
                <p className="helper-text" style={{ marginTop: "1rem" }}>
                  <Link to="/login">Log in</Link> or <Link to="/register">register</Link> to start learning.
                </p>
              )}
            </aside>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
