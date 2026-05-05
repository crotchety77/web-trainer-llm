import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";

const emptyCourse = {
  cover_image_url: "",
  title: "",
  short_description: "",
  intro_content: "",
  tags: "",
  is_published: false
};

export default function AuthorCourseEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isNew = !params.id;
  const { user } = useAuthUser({ required: true });
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [courseId, setCourseId] = useState(params.id || "");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isNew || !params.id) {
      return;
    }

    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest(`/api/courses/${params.id}`, {
          headers: getAuthHeaders()
        });

        if (!cancelled) {
          const currentCourse = response.course;
          setCourseForm({
            cover_image_url: currentCourse.cover_image_url || "",
            title: currentCourse.title || "",
            short_description: currentCourse.short_description || "",
            intro_content: currentCourse.intro_content || "",
            tags: (currentCourse.tags_json || []).join(", "),
            is_published: Boolean(currentCourse.is_published)
          });
          setCourseId(currentCourse.id);
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

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [isNew, params.id]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function updateCourseField(event) {
    const { name, value, type, checked } = event.target;
    setCourseForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      ...courseForm,
      tags_json: courseForm.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    try {
      const response = isNew
        ? await apiRequest("/api/courses", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          })
        : await apiRequest(`/api/courses/${params.id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          });

      const savedCourse = response.course;
      setCourseId(savedCourse.id);
      setMessage(isNew ? "Course created." : "Course updated.");

      if (isNew) {
        navigate(`/author/courses/${savedCourse.id}/edit`, { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title={isNew ? "Create Course" : "Edit Course"}
      subtitle="Edit the public course page that students will see before starting lessons."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <div className="action-row">
          <Link className="secondary-link-button" to="/author/dashboard">
            Back to dashboard
          </Link>
          {!isNew && courseId ? (
            <Link className="primary-link-button" to={`/author/courses/${courseId}/content`}>
              Edit course content
            </Link>
          ) : null}
        </div>

        {loading ? <p>Loading course editor...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        <form className="form" onSubmit={handleCourseSubmit}>
          <label>
            <span>Cover image URL</span>
            <input
              name="cover_image_url"
              value={courseForm.cover_image_url}
              onChange={updateCourseField}
            />
          </label>

          <label>
            <span>Title</span>
            <input name="title" value={courseForm.title} onChange={updateCourseField} required />
          </label>

          <label>
            <span>Short description</span>
            <textarea
              name="short_description"
              value={courseForm.short_description}
              onChange={updateCourseField}
              rows="3"
            />
          </label>

          <label>
            <span>Intro content</span>
            <textarea
              name="intro_content"
              value={courseForm.intro_content}
              onChange={updateCourseField}
              rows="5"
            />
          </label>

          <label>
            <span>Tags</span>
            <input
              name="tags"
              value={courseForm.tags}
              onChange={updateCourseField}
              placeholder="react, sql, backend"
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="is_published"
              checked={courseForm.is_published}
              onChange={updateCourseField}
            />
            <span>Published</span>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create course" : "Save course"}
          </button>
        </form>
      </section>
    </AppLayout>
  );
}
