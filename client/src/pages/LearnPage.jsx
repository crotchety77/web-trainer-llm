import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import ReactMarkdown from "react-markdown";
import { clearToken, getAuthHeaders } from "../lib/auth";

const STUDENT_MODES = [
  { id: 'code_help', label: '🐞 Помощь с кодом' },
  { id: 'explain', label: '📖 Объяснение' },
  { id: 'example', label: '💡 Пример' },
  { id: 'search_info', label: '🔍 Поиск' }
];

export default function LearnPage() {
  const navigate = useNavigate();
  const { courseId, lessonId } = useParams();
  const { user } = useAuthUser({ required: true });
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [solutions, setSolutions] = useState({});
  const [submissionState, setSubmissionState] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(null);

  const lessonSections = useMemo(() => {
    const sectionSize = 6;

    return lessons.reduce((sections, item) => {
      const sectionIndex = Math.floor((Number(item.position || 1) - 1) / sectionSize);
      const title = `Section ${sectionIndex + 1}`;
      const existingSection = sections.find((section) => section.title === title);

      if (existingSection) {
        existingSection.lessons.push(item);
        return sections;
      }

      sections.push({
        title,
        lessons: [item]
      });
      return sections;
    }, []);
  }, [lessons]);

  useEffect(() => {
    let cancelled = false;

    async function loadLessonData() {
      setLoading(true);
      setError("");

      try {
        const [lessonsResponse, lessonResponse] = await Promise.all([
          apiRequest(`/api/courses/${courseId}/lessons`, {
            headers: getAuthHeaders()
          }),
          apiRequest(`/api/lessons/${lessonId}`, {
            headers: getAuthHeaders()
          })
        ]);

        if (!cancelled) {
          setLessons(lessonsResponse.lessons || []);
          setLesson(lessonResponse.lesson);
        }
      } catch (requestError) {
        if (!cancelled) {
          // Если сервер отклонил запрос из-за отсутствия токена, принудительно отправляем на логин
          if (requestError.message === "Authorization token is required") {
            navigate("/login");
            return;
          } else {
            setError(requestError.message);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLessonData();

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleSolutionChange(blockId, value) {
    setSolutions((current) => ({
      ...current,
      [blockId]: value
    }));
    setSubmissionState((current) => ({
      ...current,
      [blockId]: {
        ...current[blockId],
        error: "",
        submission: null
      }
    }));
  }

  async function handleSubmitSolution(blockId) {
    const code = String(solutions[blockId] || "");

    if (!code.trim()) {
      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: "Enter your solution code before submitting.",
          submission: null
        }
      }));
      return;
    }

    setSubmissionState((current) => ({
      ...current,
      [blockId]: {
        submitting: true,
        error: "",
        submission: null
      }
    }));

    try {
      const response = await apiRequest(`/api/blocks/${blockId}/submissions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code,
          language: "javascript"
        })
      });

      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: "",
          submission: response.submission
        }
      }));
    } catch (requestError) {
      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: requestError.message,
          submission: null
        }
      }));
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((current) => [...current, { role: "user", text: userText }]);
    setIsChatLoading(true);

    try {
      const lessonContext = lesson
        ? `Текущий урок: "${lesson.title}".\nМатериалы урока:\n` + lesson.blocks.map(b => `[${b.type}] ${b.title}: ${b.content}`).join('\n')
        : "Контекст урока пока недоступен.";

      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          userInput: userText,
          lessonContext,
          chatHistory: chatMessages,
          mode: activeMode 
        })
      });

      setChatMessages((current) => [...current, { role: "assistant", text: response.message.text }]);
      setActiveMode(null);
    } catch (requestError) {
      setChatMessages((current) => [...current, { role: "assistant", text: `Ошибка: ${requestError.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <AppLayout
      title={lesson?.course_title || "Learning Workspace"}
      subtitle="Read the theory, solve the task, and keep lesson context close."
      user={user}
      onLogout={handleLogout}
    >
      <section className="learn-page">
        {loading ? <p>Loading lesson...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && lesson ? (
          <div className="learn-layout">
            <aside className="learn-sidebar" aria-label="Lesson navigation">
              <div className="learn-sidebar-header">
                <span className="eyebrow">Course</span>
                <h2>Lessons</h2>
              </div>
              <div className="lesson-accordion">
                {lessonSections.map((section) => {
                  const isCurrentSection = section.lessons.some((item) => item.id === lesson.id);

                  return (
                    <details key={section.title} className="lesson-section" open={isCurrentSection}>
                      <summary>
                        <span>{section.title}</span>
                        <span className="lesson-count">{section.lessons.length}</span>
                      </summary>
                      <div className="lesson-section-list">
                        {section.lessons.map((item) => (
                          <Link
                            key={item.id}
                            className={`lesson-link-card ${item.id === lesson.id ? "active" : ""}`}
                            to={`/learn/${courseId}/${item.id}`}
                          >
                            <span className="lesson-number">{item.position}</span>
                            <strong>
                              {item.position}. {item.title}
                            </strong>
                          </Link>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </aside>

            <div className="learn-workspace">
              <main className="lesson-content">
                <div className="lesson-header">
                  <span className="eyebrow">Lesson {lesson.position}</span>
                  <h2>
                    {lesson.position}. {lesson.title}
                  </h2>
                </div>

                <div className="lesson-stream">
                  {lesson.blocks.map((block) => {
                    const isCodeBlock = ["practice", "test"].includes(block.type);
                    const blockState = submissionState[block.id] || {};

                    return (
                      <article key={block.id} className={`learning-block ${isCodeBlock ? "with-editor" : ""}`}>
                        <div className="block-meta">
                          <span className="tag-chip">{block.type}</span>
                          <span>Step {block.position}</span>
                        </div>
                        <div className="block-copy">
                          <h3>{block.title}</h3>
                          <p>{block.content}</p>
                          {block.attachment_url ? (
                            <a href={block.attachment_url} target="_blank" rel="noreferrer">
                              Attachment
                            </a>
                          ) : null}
                        </div>

                        {isCodeBlock ? (
                          <div className="code-submission">
                            <div className="editor-shell">
                              <div className="editor-toolbar">
                                <label htmlFor={`solution-${block.id}`}>Solution code</label>
                                <span>JavaScript</span>
                              </div>
                              <textarea
                                id={`solution-${block.id}`}
                                aria-label={`Solution code for ${block.title}`}
                                className="code-editor"
                                rows={10}
                                value={solutions[block.id] || ""}
                                onChange={(event) => handleSolutionChange(block.id, event.target.value)}
                                placeholder="function solve() {&#10;  return true;&#10;}"
                              />
                            </div>

                            <div className="submission-panel" aria-live="polite">
                              <button
                                type="button"
                                className="secondary-button submit-button"
                                disabled={blockState.submitting || !user}
                                onClick={() => handleSubmitSolution(block.id)}
                              >
                                {blockState.submitting ? "Submitting..." : user ? "Submit solution" : "Log in to submit"}
                              </button>
                              {blockState.error ? (
                                <div className="check-result error-result">
                                  <span>Check failed</span>
                                  <p className="error">{blockState.error}</p>
                                </div>
                              ) : null}
                              {blockState.submission ? (
                                <div className="check-result success-result">
                                  <span>{blockState.submission.status || "Result"}</span>
                                  <p className="success">{blockState.submission.result_message}</p>
                                  {blockState.submission.tests_result ? (
                                    <div className="test-stats">
                                      <span>Total: {blockState.submission.tests_result.total}</span>
                                      <span>Passed: {blockState.submission.tests_result.passed}</span>
                                      <span>Failed: {blockState.submission.tests_result.failed}</span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {!blockState.error && !blockState.submission && !blockState.submitting ? (
                                <p className="helper-text">Run your answer when the solution is ready.</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </main>

              <aside className="assistant-panel" aria-label="Chat assistant" style={{ display: "flex", flexDirection: "column" }}>
                <div>
                  <span className="eyebrow">Assistant</span>
                  <h2>Chat</h2>
                </div>
                
                <div className="chat-quick-actions" style={{ display: "flex", gap: "0.5rem", padding: "0 0.5rem", overflowX: "auto", flexShrink: 0 }}>
                  {STUDENT_MODES.map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => user && setActiveMode(activeMode === mode.id ? null : mode.id)}
                      disabled={!user}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "12px",
                        border: "1px solid var(--border-color, #cbd5e1)",
                        background: activeMode === mode.id ? "var(--primary-color, #0284c7)" : "transparent",
                        color: activeMode === mode.id ? "#fff" : (user ? "inherit" : "var(--text-muted, #94a3b8)"),
                        cursor: user ? "pointer" : "not-allowed",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="chat-history" style={{ flex: 1, overflowY: "auto", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {chatMessages.length === 0 ? (
                    <div className="assistant-placeholder">
                      <p>{user ? "Ask for a hint, explain an error, or review your approach." : "Log in to chat with the AI assistant."}</p>
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
                  {isChatLoading && <div className="chat-message assistant" style={{ alignSelf: "flex-start", padding: "0.75rem", color: "var(--text-muted, #64748b)" }}>Typing...</div>}
                </div>

                <form className="assistant-input-row" onSubmit={handleChatSubmit}>
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={user ? "Type your question..." : "Log in to use chat..."}
                    disabled={isChatLoading || !user} 
                  />
                  <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim() || !user}>
                    Send
                  </button>
                </form>
              </aside>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
