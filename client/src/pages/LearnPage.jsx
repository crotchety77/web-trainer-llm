import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import CodeEditor from "../components/CodeEditor";
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
  const [quizAnswers, setQuizAnswers] = useState({});



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

          // Восстанавливаем ответы на опросы из БД
          const initialQuizAnswers = {};
          (lessonResponse.lesson.blocks || []).forEach(b => {
             if (b.last_quiz_answers) {
                initialQuizAnswers[b.id] = b.last_quiz_answers;
             }
          });
          if (Object.keys(initialQuizAnswers).length > 0) {
            setQuizAnswers((current) => ({ ...current, ...initialQuizAnswers }));
          }
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

  async function handleCompleteBlock(blockId) {
    if (!user) return;
    try {
      await apiRequest(`/api/blocks/${blockId}/complete`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      setLesson((current) => ({
        ...current,
        blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
      }));
    } catch (requestError) {
      console.error("Failed to mark block as completed:", requestError);
    }
  }

  async function handleSubmitQuiz(blockId) {
    const answers = quizAnswers[blockId] || [];
    
    setSubmissionState((current) => ({
      ...current,
      [blockId]: {
        submitting: true,
        error: "",
        submission: null,
        hint: null
      }
    }));

    try {
      const response = await apiRequest(`/api/blocks/${blockId}/submit`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ answers })
      });

      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: "",
          submission: response.attempt,
          hint: response.hint || null
        }
      }));

      if (response.attempt && response.attempt.is_correct) {
        setLesson((current) => ({
          ...current,
          blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
        }));
      }
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

    const block = lesson.blocks.find(b => b.id === blockId);
    const language = block?.quiz_data?.language || "javascript";

    try {
      const response = await apiRequest(`/api/blocks/${blockId}/submissions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code,
          language
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

      // Автоматически помечаем задание как выполненное в UI, если код прошел проверку успешно
      if (response.submission && ["accepted", "passed"].includes(response.submission.status)) {
        setLesson((current) => ({
          ...current,
          blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
        }));
      }
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
            <div className="stack-list" style={{ marginTop: '1rem' }}>
              {lessons.map((item, index) => {
                const displayPosition = index + 1;

                return (
                  <Link
                    key={item.id}
                    className={`lesson-link-card ${item.id === lesson?.id ? "active" : ""}`}
                    to={`/learn/${courseId}/${item.id}`}
                  >
                    <span className="lesson-number">{displayPosition}</span>
                    <strong>
                      {item.title}
                    </strong>
                  </Link>
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
                    const isCompleted = block.is_completed;

                    return (
                      <article key={block.id} className={`learning-block ${isCodeBlock ? "with-editor" : ""} ${isCompleted ? "completed-block" : ""}`} style={isCompleted ? { borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' } : {}}>
                        <div className="block-meta">
                          <span className="tag-chip">{block.type}</span>
                          <span>Step {block.position}</span>
                          {isCompleted && (
                            <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>
                              ✓ Выполнено
                            </span>
                          )}
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

                        {!isCodeBlock && !isCompleted && user && (
                          <div className="block-actions" style={{ marginTop: '1rem' }}>
                            <button type="button" className="secondary-button" onClick={() => handleCompleteBlock(block.id)}>
                              Отметить как прочитанное
                            </button>
                          </div>
                        )}

                        {block.quiz_data && block.quiz_data.options && block.quiz_data.options.length > 0 ? (
                          <div className="quiz-renderer" style={{ marginTop: '1.5rem', background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)' }}>
                            <h4 style={{ marginBottom: '1rem' }}>Опрос</h4>
                            <form onSubmit={(e) => { e.preventDefault(); handleSubmitQuiz(block.id); }}>
                              {block.quiz_data.options.map((opt, idx) => {
                                const isMultiple = block.quiz_data.quiz_type === "multiple";
                                const isChecked = (quizAnswers[block.id] || []).includes(idx);
                                return (
                                  <label key={idx} style={{ display: 'block', marginBottom: '0.75rem', cursor: isCompleted ? 'default' : 'pointer', padding: '0.75rem', borderRadius: '6px', border: `1px solid ${isChecked ? 'var(--primary-color, #0284c7)' : '#e2e8f0'}`, background: isChecked ? 'var(--primary-light, #e0f2fe)' : '#f8fafc' }}>
                                    <input 
                                      type={isMultiple ? "checkbox" : "radio"}
                                      name={`quiz-${block.id}`}
                                      checked={isChecked}
                                      disabled={isCompleted || blockState.submitting}
                                      onChange={(e) => {
                                        if (isMultiple) {
                                          setQuizAnswers(cur => {
                                            const prev = cur[block.id] || [];
                                            return { ...cur, [block.id]: e.target.checked ? [...prev, idx] : prev.filter(i => i !== idx) };
                                          });
                                        } else {
                                          setQuizAnswers(cur => ({ ...cur, [block.id]: [idx] }));
                                        }
                                      }}
                                      style={{ marginRight: '0.75rem', accentColor: 'var(--primary-color)' }}
                                    />
                                    {opt.text}
                                  </label>
                                );
                              })}
                              <div className="submission-panel" aria-live="polite" style={{ marginTop: '1rem' }}>
                                <button type="submit" className="secondary-button submit-button" disabled={blockState.submitting || isCompleted || !user || (quizAnswers[block.id] || []).length === 0}>
                                  {blockState.submitting ? "Проверка..." : isCompleted ? "Пройдено" : user ? "Ответить" : "Войдите для ответа"}
                                </button>
                                {blockState.error && <div className="check-result error-result" style={{ marginTop: '0.5rem' }}><span>Ошибка</span><p className="error">{blockState.error}</p></div>}
                                {blockState.hint && <div className="check-result error-result" style={{ marginTop: '0.5rem' }}><span>Неверно</span><p className="error">{blockState.hint}</p></div>}
                                {blockState.submission && blockState.submission.is_correct && <div className="check-result success-result" style={{ marginTop: '0.5rem' }}><span>Успех</span><p className="success">Правильный ответ!</p></div>}
                              </div>
                            </form>
                          </div>
                        ) : isCodeBlock ? (
                          <div className="code-submission">
                            <div className="editor-shell">
                              <div className="editor-toolbar">
                                <label htmlFor={`solution-${block.id}`}>Solution code</label>
                                <span>{block.quiz_data?.language || "javascript"}</span>
                              </div>
                                <CodeEditor
                                  value={solutions[block.id] !== undefined ? solutions[block.id] : (block.quiz_data?.placeholder_code || "")}
                                  onChange={(val) => handleSolutionChange(block.id, val)}
                                  language={block.quiz_data?.language || "javascript"}
                                  height={300}
                                />
                                {block.quiz_data?.function_name && (
                                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.5rem", padding: "0.5rem", background: "#f8fafc", borderRadius: "4px" }}>
                                    💡 <strong>Подсказка:</strong> Система автоматически прочитает ввод и вызовет вашу функцию <code>{block.quiz_data.function_name}</code> с нужными аргументами.
                                  </div>
                                )}
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
                                <div className={`check-result ${blockState.submission.status === "passed" || blockState.submission.status === "accepted" ? "success-result" : "error-result"}`}>
                                  <span>{blockState.submission.status || "Result"}</span>
                                  <p className={blockState.submission.status === "passed" || blockState.submission.status === "accepted" ? "success" : "error"}>{blockState.submission.result_message}</p>
                                  {blockState.submission.tests_result ? (
                                    <div className="test-stats" style={{ marginTop: "1rem" }}>
                                      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontWeight: "bold" }}>
                                        <span>Всего: {blockState.submission.tests_result.total}</span>
                                        <span style={{ color: "#10b981" }}>Успешно: {blockState.submission.tests_result.passed}</span>
                                        <span style={{ color: "#ef4444" }}>Упало: {blockState.submission.tests_result.failed}</span>
                                      </div>
                                      
                                      {(blockState.submission.tests_result.details || []).map((detail, idx) => (
                                        <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", background: detail.passed ? "#f0fdf4" : "#fef2f2" }}>
                                          <div style={{ fontWeight: "bold", marginBottom: "0.5rem", color: detail.passed ? "#15803d" : "#b91c1c" }}>
                                            Тест #{idx + 1} {detail.passed ? "✓ Пройден" : "✗ Упал"}
                                          </div>
                                          {!detail.passed && !detail.is_hidden && (
                                            <div style={{ fontSize: "0.85rem", display: "grid", gap: "0.5rem" }}>
                                              <div><strong style={{ color: "#64748b" }}>Ввод (stdin):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px" }}>{detail.input}</pre></div>
                                              <div><strong style={{ color: "#64748b" }}>Ожидалось (stdout):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px" }}>{detail.expected}</pre></div>
                                              <div><strong style={{ color: "#64748b" }}>Ваш вывод:</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#b91c1c" }}>{detail.actual}</pre></div>
                                            </div>
                                          )}
                                          {!detail.passed && detail.is_hidden && (
                                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Скрытый тест. Детали не отображаются.</div>
                                          )}
                                        </div>
                                      ))}
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
