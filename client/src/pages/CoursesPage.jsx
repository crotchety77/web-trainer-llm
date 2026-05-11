import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken } from "../lib/auth";
import { useToast } from "../hooks/useToast";

const DEFAULT_TAGS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", 
  "SQL", "JWT", "HTML", "CSS", "Go", "Docker"
];

export default function CoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [tag, setTag] = useState(searchParams.get("tag") || "");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const allTags = useMemo(() => {
    return [...new Set(courses.flatMap((course) => course.tags_json || []))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [courses]);

  const combinedTags = useMemo(() => {
    return Array.from(new Set([...DEFAULT_TAGS, ...allTags]));
  }, [allTags]);

  const filteredTags = combinedTags.filter(t => 
    t.toLowerCase().includes(tag.toLowerCase())
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);

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
          toast.error("Не удалось загрузить курсы");
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
  }, [search, tag, toast]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      title="Доступные курсы"
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <form className="filters-row" onSubmit={handleSearchSubmit}>
          <label className="inline-field">
            <span>Поиск</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию, intro"
            />
          </label>

          <label className="inline-field" ref={wrapperRef} style={{ position: 'relative' }}>
            <span>Теги</span>
            <input
              type="text"
              value={tag}
              onChange={(event) => {
                setTag(event.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="React, SQL..."
              autoComplete="off"
            />
            {isOpen && filteredTags.length > 0 && (
              <ul className="custom-dropdown">
                {filteredTags.slice(0, 5).map((item) => (
                  <li 
                    key={item} 
                    onClick={() => {
                      setTag(item);
                      setIsOpen(false);
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </label>

          <button type="submit" className="secondary-button" style={{ marginLeft: 'auto' }}>
            🔍 Поиск
          </button>
        </form>

        {loading ? <p>Загрузка курсов...</p> : null}

        {!loading && !courses.length ? <p>По вашему запросу ничего не найдено.</p> : null}

        <div className="course-list">
          {courses.map((course) => (
            <article key={course.id} className="course-card">
              <div className="course-card-media">
                {course.cover_image_url ? (
                  <img className="cover-image" src={course.cover_image_url} alt={course.title} />
                ) : (
                  <div className="cover-placeholder">Нет обложки</div>
                )}

                <Link className="primary-link-button" to={`/courses/${course.id}`}>
                  Просмотр
                </Link>
              </div>

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
                  <span>Автор: {course.author_name}</span>
                  <span>Уроков: {course.lessons_count}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
