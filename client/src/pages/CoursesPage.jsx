import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken } from "../lib/auth";

export default function CoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [tag, setTag] = useState(searchParams.get("tag") || "");

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setError("");

      const query = new URLSearchParams();
      if (search) {
        query.set("search", search);
      }
      if (tag) {
        query.set("tag", tag);
      }

      try {
        const data = await apiRequest(`/api/courses${query.toString() ? `?${query}` : ""}`);
        if (!cancelled) {
          setCourses(data.courses || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [search, tag]);

  const allTags = useMemo(() => {
    return [...new Set(courses.flatMap((course) => course.tags_json || []))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [courses]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search) {
      next.set("search", search);
    }
    if (tag) {
      next.set("tag", tag);
    }
    setSearchParams(next);
  }

  return (
    <AppLayout
      title="Published Courses"
      subtitle="Student-facing catalog with simple search and tag filtering."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <form className="filters-row" onSubmit={handleSearchSubmit}>
          <label className="inline-field">
            <span>Search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="React, SQL, JWT..."
            />
          </label>

          <label className="inline-field">
            <span>Tag</span>
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="">All tags</option>
              {allTags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">Apply</button>
        </form>

        {loading ? <p>Loading courses...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !courses.length ? <p>No published courses match this filter.</p> : null}

        <div className="course-list">
          {courses.map((course) => (
            <article key={course.id} className="course-card">
              {course.cover_image_url ? (
                <img className="cover-image" src={course.cover_image_url} alt={course.title} />
              ) : (
                <div className="cover-placeholder">No cover</div>
              )}

              <div className="course-card-body">
                <div className="tag-row">
                  {(course.tags_json || []).map((item) => (
                    <span key={item} className="tag-chip">
                      {item}
                    </span>
                  ))}
                </div>

                <h2>{course.title}</h2>
                <p>{course.short_description}</p>

                <div className="meta-row">
                  <span>Author: {course.author_name}</span>
                  <span>Lessons: {course.lessons_count}</span>
                </div>

                <Link className="primary-link-button" to={`/courses/${course.id}`}>
                  Open course
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
