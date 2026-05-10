import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

export default function AuthorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser({ required: true });
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMyCourses() {
      setLoading(true);

      try {
        const data = await apiRequest("/api/my/courses", {
          headers: getAuthHeaders()
        });

        if (!cancelled) {
          setCourses(data.courses || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          toast.error("Не удалось загрузить ваши курсы");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMyCourses();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <AppLayout
      title="Author Dashboard"
      subtitle="Manage your own courses, lessons, and lesson blocks."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <div className="action-row">
          <Link className="primary-link-button" to="/author/courses/new">
            Create course
          </Link>
        </div>

        {loading ? <p>Loading your courses...</p> : null}

        <div className="course-list">
          {courses.map((course) => (
            <article key={course.id} className="course-card compact">
              <div className="course-card-body">
                <div className="meta-row">
                  <span>{course.is_published ? "Published" : "Draft"}</span>
                  <span>Lessons: {course.lessons_count}</span>
                </div>
                <h2>{course.title}</h2>
                <p>{course.short_description}</p>
                <div className="action-row">
                  <Link className="primary-link-button" to={`/author/courses/${course.id}/edit`}>
                    Edit course page
                  </Link>
                  <Link className="secondary-link-button" to={`/author/courses/${course.id}/content`}>
                    Edit content
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
