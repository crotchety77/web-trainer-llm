import { useEffect, useMemo, useState } from "react";
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

const emptyLesson = {
  title: "",
  position: 1
};

const emptyBlock = {
  type: "lecture",
  title: "",
  content: "",
  attachment_url: "",
  position: 1
};

export default function AuthorCourseEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isNew = !params.id;
  const { user } = useAuthUser({ required: true });
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [courseId, setCourseId] = useState(params.id || "");
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [lessonDetail, setLessonDetail] = useState(null);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [newBlockForm, setNewBlockForm] = useState(emptyBlock);
  const [blockDrafts, setBlockDrafts] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) || null;
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (isNew || !params.id) {
      return;
    }

    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError("");

      try {
        const [courseResponse, lessonsResponse] = await Promise.all([
          apiRequest(`/api/courses/${params.id}`, {
            headers: getAuthHeaders()
          }),
          apiRequest(`/api/courses/${params.id}/lessons`, {
            headers: getAuthHeaders()
          })
        ]);

        if (!cancelled) {
          const currentCourse = courseResponse.course;
          setCourseForm({
            cover_image_url: currentCourse.cover_image_url || "",
            title: currentCourse.title || "",
            short_description: currentCourse.short_description || "",
            intro_content: currentCourse.intro_content || "",
            tags: (currentCourse.tags_json || []).join(", "),
            is_published: Boolean(currentCourse.is_published)
          });
          setLessons(lessonsResponse.lessons || []);
          if (lessonsResponse.lessons?.length) {
            setSelectedLessonId(lessonsResponse.lessons[0].id);
          }
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

  useEffect(() => {
    if (!selectedLessonId) {
      setLessonDetail(null);
      return;
    }

    let cancelled = false;

    async function loadLesson() {
      try {
        const response = await apiRequest(`/api/lessons/${selectedLessonId}`, {
          headers: getAuthHeaders()
        });

        if (!cancelled) {
          setLessonDetail(response.lesson);
          setLessonForm({
            title: response.lesson.title,
            position: response.lesson.position
          });
          setBlockDrafts(
            Object.fromEntries(
              (response.lesson.blocks || []).map((block) => [
                block.id,
                {
                  type: block.type,
                  title: block.title,
                  content: block.content,
                  attachment_url: block.attachment_url,
                  position: block.position
                }
              ])
            )
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      }
    }

    loadLesson();

    return () => {
      cancelled = true;
    };
  }, [selectedLessonId]);

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
      setMessage(isNew ? "Course created." : "Course updated.");

      if (isNew) {
        setCourseId(savedCourse.id);
        navigate(`/author/courses/${savedCourse.id}/edit`, { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLessonCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!courseId && !params.id) {
      setError("Create the course first before adding lessons.");
      return;
    }

    try {
      const targetCourseId = courseId || params.id;
      const response = await apiRequest(`/api/courses/${targetCourseId}/lessons`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(lessonForm)
      });

      const createdLesson = response.lesson;
      setLessons((current) => [...current, createdLesson].sort((a, b) => a.position - b.position));
      setSelectedLessonId(createdLesson.id);
      setLessonForm(emptyLesson);
      setMessage("Lesson created.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleLessonUpdate(event) {
    event.preventDefault();
    if (!selectedLesson) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(lessonForm)
      });

      setLessons((current) =>
        current
          .map((item) => (item.id === selectedLesson.id ? response.lesson : item))
          .sort((a, b) => a.position - b.position)
      );
      setMessage("Lesson updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleNewBlockCreate(event) {
    event.preventDefault();
    if (!selectedLesson) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/lessons/${selectedLesson.id}/blocks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(newBlockForm)
      });
      const lessonResponse = await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        headers: getAuthHeaders()
      });
      setLessonDetail(lessonResponse.lesson);
      setNewBlockForm(emptyBlock);
      setMessage("Block created.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleBlockUpdate(blockId) {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/blocks/${blockId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(blockDrafts[blockId])
      });
      const lessonResponse = await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        headers: getAuthHeaders()
      });
      setLessonDetail(lessonResponse.lesson);
      setMessage("Block updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <AppLayout
      title={isNew ? "Create Course" : "Edit Course"}
      subtitle="Minimal authoring workspace for course metadata, lessons, and lesson blocks."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <div className="action-row">
          <Link className="secondary-link-button" to="/author/dashboard">
            Back to dashboard
          </Link>
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

      {!isNew ? (
        <section className="editor-grid">
          <aside className="panel">
            <h2>Lessons</h2>
            <div className="stack-list">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={`lesson-link-card button-card ${lesson.id === selectedLessonId ? "active" : ""}`}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  <strong>
                    {lesson.position}. {lesson.title}
                  </strong>
                </button>
              ))}
            </div>

            <form className="form compact-form" onSubmit={handleLessonCreate}>
              <h3>Create lesson</h3>
              <label>
                <span>Title</span>
                <input
                  value={lessonForm.title}
                  onChange={(event) =>
                    setLessonForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Position</span>
                <input
                  type="number"
                  min="1"
                  value={lessonForm.position}
                  onChange={(event) =>
                    setLessonForm((current) => ({
                      ...current,
                      position: Number(event.target.value) || 1
                    }))
                  }
                />
              </label>
              <button type="submit">Add lesson</button>
            </form>
          </aside>

          <div className="panel">
            {selectedLesson && lessonDetail ? (
              <>
                <form className="form compact-form" onSubmit={handleLessonUpdate}>
                  <h2>Edit lesson</h2>
                  <label>
                    <span>Title</span>
                    <input
                      value={lessonForm.title}
                      onChange={(event) =>
                        setLessonForm((current) => ({ ...current, title: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Position</span>
                    <input
                      type="number"
                      min="1"
                      value={lessonForm.position}
                      onChange={(event) =>
                        setLessonForm((current) => ({
                          ...current,
                          position: Number(event.target.value) || 1
                        }))
                      }
                    />
                  </label>
                  <button type="submit">Save lesson</button>
                </form>

                <form className="form compact-form" onSubmit={handleNewBlockCreate}>
                  <h2>Create block</h2>
                  <label>
                    <span>Type</span>
                    <select
                      value={newBlockForm.type}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({ ...current, type: event.target.value }))
                      }
                    >
                      <option value="lecture">lecture</option>
                      <option value="practice">practice</option>
                      <option value="test">test</option>
                    </select>
                  </label>
                  <label>
                    <span>Title</span>
                    <input
                      value={newBlockForm.title}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({ ...current, title: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Content</span>
                    <textarea
                      rows="4"
                      value={newBlockForm.content}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({ ...current, content: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>Attachment URL</span>
                    <input
                      value={newBlockForm.attachment_url}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({
                          ...current,
                          attachment_url: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Position</span>
                    <input
                      type="number"
                      min="1"
                      value={newBlockForm.position}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({
                          ...current,
                          position: Number(event.target.value) || 1
                        }))
                      }
                    />
                  </label>
                  <button type="submit">Add block</button>
                </form>

                <div className="stack-list">
                  {lessonDetail.blocks.map((block) => (
                    <form
                      key={block.id}
                      className="block-card form compact-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleBlockUpdate(block.id);
                      }}
                    >
                      <div className="block-meta">
                        <span className="tag-chip">{block.type}</span>
                        <span>#{block.id}</span>
                      </div>
                      <label>
                        <span>Type</span>
                        <select
                          value={blockDrafts[block.id]?.type || block.type}
                          onChange={(event) =>
                            setBlockDrafts((current) => ({
                              ...current,
                              [block.id]: {
                                ...current[block.id],
                                type: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="lecture">lecture</option>
                          <option value="practice">practice</option>
                          <option value="test">test</option>
                        </select>
                      </label>
                      <label>
                        <span>Title</span>
                        <input
                          value={blockDrafts[block.id]?.title || ""}
                          onChange={(event) =>
                            setBlockDrafts((current) => ({
                              ...current,
                              [block.id]: {
                                ...current[block.id],
                                title: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Content</span>
                        <textarea
                          rows="4"
                          value={blockDrafts[block.id]?.content || ""}
                          onChange={(event) =>
                            setBlockDrafts((current) => ({
                              ...current,
                              [block.id]: {
                                ...current[block.id],
                                content: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Attachment URL</span>
                        <input
                          value={blockDrafts[block.id]?.attachment_url || ""}
                          onChange={(event) =>
                            setBlockDrafts((current) => ({
                              ...current,
                              [block.id]: {
                                ...current[block.id],
                                attachment_url: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Position</span>
                        <input
                          type="number"
                          min="1"
                          value={blockDrafts[block.id]?.position || 1}
                          onChange={(event) =>
                            setBlockDrafts((current) => ({
                              ...current,
                              [block.id]: {
                                ...current[block.id],
                                position: Number(event.target.value) || 1
                              }
                            }))
                          }
                        />
                      </label>
                      <button type="submit">Save block</button>
                    </form>
                  ))}
                </div>
              </>
            ) : (
              <p>Select a lesson to edit blocks.</p>
            )}
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}
