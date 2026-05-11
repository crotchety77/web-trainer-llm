import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import AssistantTextarea from "../components/AssistantTextarea";
import AssistantUnavailableNotice from "../components/AssistantUnavailableNotice";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import ReactMarkdown from "react-markdown";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

const emptyCourse = {
  cover_image_url: "",
  title: "",
  short_description: "",
  intro_content: "",
  tags: "",
  is_published: false
};

function buildCourseEditorContext(courseForm) {
  const tags = courseForm.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [
    "Автор редактирует публичную карточку курса.",
    "Задача ассистента: помогать сформулировать короткое описание, вводный текст и подобрать точные хештеги по текущему контексту курса.",
    "",
    `Название: ${courseForm.title || "(не заполнено)"}`,
    `Короткое описание: ${courseForm.short_description || "(не заполнено)"}`,
    `Вводный текст: ${courseForm.intro_content || "(не заполнено)"}`,
    `Текущие теги: ${tags.length > 0 ? tags.join(", ") : "(не заполнены)"}`,
    `Статус публикации: ${courseForm.is_published ? "published" : "draft"}`
  ].join("\n");
}

export default function AuthorCourseEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isNew = !params.id;
  const { user } = useAuthUser({ required: true });
  const isAssistantAvailable = Boolean(user?.has_llm_api_key && user?.has_llm_folder_id);
  const toast = useToast();
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [courseId, setCourseId] = useState(params.id || "");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    if (isNew || !params.id) {
      return;
    }

    let cancelled = false;

    async function loadCourse() {
      setLoading(true);

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
  }, [isNew, params.id, toast]);

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
      toast.success(isNew ? "Курс успешно создан" : "Изменения сохранены");

      if (isNew) {
        navigate(`/author/courses/${savedCourse.id}/edit`, { replace: true });
      }
    } catch (requestError) {
      toast.error(isNew ? "Не удалось создать курс" : "Не удалось сохранить курс");
    } finally {
      setSaving(false);
    }
  }

  async function handleChatSubmit(event) {
    event?.preventDefault();
    if (!chatInput.trim() || isChatLoading || !isAssistantAvailable) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((current) => [...current, { role: "user", text: userText }]);
    setIsChatLoading(true);
    toast.info("Генерируем ответ ассистента...");

    try {
      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userInput: userText,
          lessonContext: buildCourseEditorContext(courseForm),
          chatHistory: chatMessages,
          mode: null
        })
      });

      setChatMessages((current) => [...current, { role: "assistant", text: response.message.text }]);
      toast.success("Ответ ассистента готов");
    } catch (requestError) {
      setChatMessages((current) => [...current, { role: "assistant", text: `Ошибка: ${requestError.message}` }]);
      toast.error("Не удалось получить ответ ассистента");
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <AppLayout
      title={isNew ? "Create Course" : "Edit Course"}
      subtitle="Edit the public course page that students will see before starting lessons."
      user={user}
      onLogout={handleLogout}
    >
      <div className="course-editor-page-layout">
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

        <aside className="author-assistant-panel course-page-assistant" aria-label="Course page assistant">
          <div className="author-panel-header">
            <span className="eyebrow">Assistant</span>
            <h2>Course page</h2>
          </div>

          <div className="chat-history">
            {chatMessages.length === 0 ? (
              <div className="author-assistant-placeholder">
                {isAssistantAvailable ? (
                  <p>Ask for a stronger short description, intro rewrite, or better tags for this course page.</p>
                ) : (
                  <AssistantUnavailableNotice />
                )}
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? "var(--surface-color, #f1f5f9)" : "var(--primary-light, #e0f2fe)", padding: "0.75rem", borderRadius: "8px", maxWidth: "90%" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>{msg.role === "user" ? "You" : "AI Assistant"}</strong>
                  {msg.role === "assistant" ? (
                    <div className="markdown-content" style={{ paddingTop: "0.25rem", fontSize: "0.95rem" }}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p style={{ margin: "0.25rem 0 0 0", whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>{msg.text}</p>
                  )}
                </div>
              ))
            )}
            {isChatLoading ? (
              <div className="chat-message assistant" style={{ alignSelf: "flex-start", padding: "0.75rem", color: "var(--text-muted, #64748b)" }}>Typing...</div>
            ) : null}
          </div>

          <form className="assistant-input-row" onSubmit={handleChatSubmit}>
            <AssistantTextarea
              value={chatInput}
              onChange={setChatInput}
              onSubmit={() => handleChatSubmit()}
              placeholder={isAssistantAvailable ? "Например:\nСделай описание курса сильнее\nПодбери 5 тегов по теме курса" : "Чат недоступен. Добавьте API ключ и Folder ID."}
              disabled={isChatLoading || !isAssistantAvailable}
            />
            <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim() || !isAssistantAvailable}>
              Send
            </button>
          </form>
        </aside>
      </div>
    </AppLayout>
  );
}
