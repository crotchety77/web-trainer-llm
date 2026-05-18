import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import CodeEditor from "../components/CodeEditor";
import CodeTaskTestResults from "../components/CodeTaskTestResults";
import AIChatPanel from "../components/AIChatPanel";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest, getApiUrl } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { extractStepRefs } from "../utils/extractStepRefs";
import { buildLessonSummaryContext, buildStepsContext } from "../utils/aiContextBuilders";
import { useToast } from "../hooks/useToast";

const STUDENT_MODES = [
  { id: 'code_help', label: '🐞 Помощь с кодом' },
  { id: 'explain', label: '📖 Объяснение' },
  { id: 'example', label: '💡 Пример' },
  { id: 'search_info', label: '🔍 Поиск' }
];

const MODE_DESCRIPTIONS = {
  default: `Ассистент поможет разобраться в задаче, найти ошибку, объяснить теорию или подсказать направление решения.

Можно использовать:
@step2 почему ошибка?
@step1 объясни задачу`,
  code_help: "Помогает находить ошибки в коде, объясняет причины проблем и подсказывает направление исправления без готового решения.",
  explain: "Объясняет теорию и логику решения простыми словами и пошагово разбирает сложные моменты.",
  example: "Показывает похожие примеры и аналогии, чтобы помочь понять принцип решения задачи.",
  search_info: "Помогает быстро получить краткую информацию, объяснение термина или ответ по теме урока."
};

const localizeError = (msg) => {
  if (msg === "You do not have access to this action") {
    return "Вы зашли как автор и не можете проходить курс.\nПожалуйста, перезайдите под аккаунтом студента.";
  }
  return msg;
};

function getBlockAttachments(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item?.url);
    }
  } catch {
    // Existing blocks may still store a single URL.
  }

  return [{ original_name: "Прикрепленный файл", url: value }];
}

function getAttachmentHref(url) {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }

  return `${getApiUrl()}${url}`;
}

export default function LearnPage() {
  const navigate = useNavigate();
  const { courseId, lessonId } = useParams();
  const { user } = useAuthUser({ required: true });
  const isAssistantAvailable = Boolean(user?.has_llm_api_key && user?.has_llm_folder_id);
  const toast = useToast();
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solutions, setSolutions] = useState({});
  const [submissionState, setSubmissionState] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});

  const sortedBlocks = useMemo(() => {
    if (!lesson?.blocks) return [];
    return [...lesson.blocks].sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [lesson?.blocks]);
  const detectedStepRefs = useMemo(() => extractStepRefs(chatInput), [chatInput]);

  const activeLessonRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [chatMessages, isChatLoading]);

  useEffect(() => {
    if (activeLessonRef.current && lessons.length > 0) {
      const activeIndex = lessons.findIndex(l => l.id === lesson?.id);
      // Скроллим только если урок находится за пределами первого экрана (например, после 15-го)
      if (activeIndex > 14) {
        activeLessonRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'start'
        });
      }
    }
  }, [lesson?.id, lessons]);



  useEffect(() => {
    let cancelled = false;

    async function loadLessonData() {
      setLoading(true);

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
            toast.error("Не удалось загрузить урок");
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
  }, [courseId, lessonId, navigate, toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function handleCompleteBlock(blockId) {
    if (!user) return;

    setSubmissionState((current) => ({
      ...current,
      [blockId]: { submitting: true, error: "" }
    }));

    try {
      await apiRequest(`/api/blocks/${blockId}/complete`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      setLesson((current) => ({
        ...current,
        blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
      }));
      setSubmissionState((current) => ({
        ...current,
        [blockId]: { submitting: false, error: "" }
      }));
      toast.success("Шаг отмечен как пройденный");
    } catch (requestError) {
      console.error("Failed to mark block as completed:", requestError);
      setSubmissionState((current) => ({
        ...current,
        [blockId]: { submitting: false, error: localizeError(requestError.message) }
      }));
      toast.error("Не удалось отметить шаг");
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
        toast.success("Ответ верный");
        setLesson((current) => ({
          ...current,
          blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
        }));
      } else {
        toast.warning("Ответ неверный");
      }
    } catch (requestError) {
      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: localizeError(requestError.message),
          submission: null
        }
      }));
      toast.error("Не удалось проверить ответ");
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
          error: "Пожалуйста, введите код решения перед отправкой.",
          submission: null
        }
      }));
      toast.warning("Введите код решения");
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
        toast.success("Решение прошло проверку");
        setLesson((current) => ({
          ...current,
          blocks: current.blocks.map((b) => (b.id === blockId ? { ...b, is_completed: true } : b))
        }));
      } else {
        toast.error("Решение не прошло проверку");
      }
    } catch (requestError) {
      setSubmissionState((current) => ({
        ...current,
        [blockId]: {
          submitting: false,
          error: localizeError(requestError.message),
          submission: null
        }
      }));
      toast.error("Ошибка выполнения кода");
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
      const lessonContext = buildLessonSummaryContext(lesson, sortedBlocks);
      const stepsContext = buildStepsContext({
        text: userText,
        sortedBlocks,
        solutions,
        submissionState
      });

      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userInput: userText,
          lessonContext,
          stepsContext,
          chatHistory: chatMessages,
          mode: activeMode
        })
      });

      setChatMessages((current) => [...current, { role: "assistant", text: response.message.text }]);
      toast.success("Ответ ассистента готов");
      setActiveMode(null);
    } catch (requestError) {
      setChatMessages((current) => [...current, { role: "assistant", text: `Ошибка: ${requestError.message}` }]);
      toast.error("Не удалось получить ответ ассистента");
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <AppLayout
      title={lesson?.course_title || "Процесс обучения"}
      user={user}
      onLogout={handleLogout}
      heroLink={`/courses/${courseId}`}
    >
      <section className="learn-page">
        {loading ? <p>Загрузка урока...</p> : null}

        {!loading && lesson ? (
          <div className="learn-layout">
            <aside className="learn-sidebar" aria-label="Lesson navigation">
              <div className="learn-sidebar-header">
                <span className="eyebrow">Курс</span>
                <h2>Уроки</h2>
              </div>
              <div className="stack-list" style={{ marginTop: '1rem' }}>
                {lessons.map((item, index) => {
                  const displayPosition = index + 1;

                  return (
                    <Link
                      key={item.id}
                      ref={item.id === lesson?.id ? activeLessonRef : null}
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
                  <span className="eyebrow">Урок {lesson.position}</span>
                  <h2>
                    {lesson.position}. {lesson.title}
                  </h2>
                </div>

                <div className="lesson-stream">
                  {sortedBlocks.map((block, index) => {
                    const isCodeBlock = ["practice", "test"].includes(block.type);
                    const blockState = submissionState[block.id] || {};
                    const isCompleted = block.is_completed;

                    return (
                      <article key={block.id} className={`learning-block ${isCodeBlock ? "with-editor" : ""} ${isCompleted ? "completed-block" : ""}`} style={isCompleted ? { borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' } : {}}>
                        <div className="block-meta">
                          <span className="tag-chip">{block.type}</span>
                          <span>Шаг {index + 1}</span>
                          {isCompleted && (
                            <span style={{ color: '#10b981', marginLeft: 'auto', fontWeight: 'bold' }}>
                              ✓ Выполнено
                            </span>
                          )}
                        </div>
                        <div className="block-copy">
                          <h3>{block.title}</h3>
                          <p style={{ whiteSpace: "pre-wrap" }}>{block.content}</p>
                          {block.type === "lecture" && getBlockAttachments(block.attachment_url).length ? (
                            <div className="lecture-attachments">
                              {getBlockAttachments(block.attachment_url).map((attachment) => (
                                <a
                                  key={attachment.stored_name || attachment.url}
                                  href={getAttachmentHref(attachment.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {attachment.original_name || "Скачать файл"}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {!isCodeBlock && !isCompleted && user && (
                          <div className="block-actions">
                            {blockState.error && (
                              <div className="check-result error-result" style={{ margin: 0, flex: 1 }}>
                                <span>Ошибка</span>
                                <p className="result-text-error">{blockState.error}</p>
                              </div>
                            )}
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={blockState.submitting}
                              onClick={() => handleCompleteBlock(block.id)}
                            >
                              {blockState.submitting ? "Обработка..." : "Отметить как прочитанное"}
                            </button>
                          </div>
                        )}

                        {block.quiz_data && block.quiz_data.options && block.quiz_data.options.length > 0 ? (
                          <div className="quiz-renderer">
                            <h4>Опрос</h4>
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
                                {blockState.error && <div className="check-result error-result" style={{ marginTop: '0.5rem' }}><span>Ошибка</span><p className="result-text-error">{blockState.error}</p></div>}
                                {blockState.hint && <div className="check-result error-result" style={{ marginTop: '0.5rem' }}><span>Неверно</span><p className="result-text-error">{blockState.hint}</p></div>}
                                {blockState.submission && blockState.submission.is_correct && <div className="check-result success-result" style={{ marginTop: '0.5rem' }}><span>Успех</span><p className="result-text-success">Правильный ответ!</p></div>}
                              </div>
                            </form>
                          </div>
                        ) : isCodeBlock ? (
                          <div className="code-submission">
                            <div className="editor-shell">
                              <div className="editor-toolbar">
                                <label htmlFor={`solution-${block.id}`}>Код решения</label>
                                <span>{block.quiz_data?.language || "javascript"}</span>
                              </div>
                              <CodeEditor
                                ariaLabel={`Solution code for ${block.title}`}
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
                                {blockState.submitting ? "Отправка..." : user ? "Проверить решение" : "Войдите для проверки"}
                              </button>
                              {blockState.error ? (
                                <div className="check-result error-result">
                                  <span>Ошибка проверки</span>
                                  <p className="result-text-error">{blockState.error}</p>
                                </div>
                              ) : null}
                              {blockState.submission && (
                                <CodeTaskTestResults results={blockState.submission} isAuthor={false} />
                              )}
                              {!blockState.error && !blockState.submission && !blockState.submitting ? (
                                <p className="helper-text">Запустите проверку, когда решение будет готово.</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </main>

              <AIChatPanel
                className="assistant-panel"
                user={user}
                messages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSendMessage={handleChatSubmit}
                onClearHistory={() => setChatMessages([])}
                isChatLoading={isChatLoading}
                isAssistantAvailable={isAssistantAvailable}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                modes={STUDENT_MODES}
                modeDescriptions={MODE_DESCRIPTIONS}
                detectedContext={detectedStepRefs}
                chatEndRef={chatEndRef}
              />
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
