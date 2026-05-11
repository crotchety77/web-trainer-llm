import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import CodeEditor from "../components/CodeEditor";
import AssistantTextarea from "../components/AssistantTextarea";
import AssistantUnavailableNotice from "../components/AssistantUnavailableNotice";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import ReactMarkdown from "react-markdown";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

const emptyLesson = {
  title: "",
  position: 1
};

const emptyBlock = {
  type: "lecture",
  title: "",
  content: "",
  attachment_url: "",
  position: 1,
  quiz_data: { quiz_type: "single", options: [] }
};

const AUTHOR_MODES = [
  { id: 'improve_text', label: '📝 Улучшить', icon: '📝' },
  { id: 'generate_task', label: '🎯 Задание', icon: '🎯' },
  { id: 'structure', label: '📑 Структура', icon: '📑' },
];

const AUTHOR_MODE_DESCRIPTIONS = {
  default: "Ассистент поможет улучшить объяснение, придумать практическое задание, структурировать урок или доработать подсказки для студентов.",
  improve_text: "Улучшает текст выбранного блока: делает объяснение яснее, короче и удобнее для восприятия студентом.",
  generate_task: "Помогает придумать практическое задание, тестовые случаи, варианты ответов и подсказки по теме урока.",
  structure: "Помогает выстроить структуру урока: порядок блоков, логические переходы, цели и последовательность материала."
};

function createBlockDrafts(blocks) {
  return Object.fromEntries(
    blocks.map((block) => {
      const qData = block.quiz_data && Array.isArray(block.quiz_data.options)
        ? block.quiz_data
        : { quiz_type: "single", options: [] };
      return [
        block.id,
        {
          type: block.type,
          title: block.title,
          content: block.content,
          attachment_url: block.attachment_url,
          position: block.position,
          quiz_data: qData
        }
      ];
    })
  );
}

function moveItem(items, fromId, toId) {
  if (fromId === toId) {
    return items;
  }

  const nextItems = [...items];
  const fromIndex = nextItems.findIndex((item) => item.id === fromId);
  const toIndex = nextItems.findIndex((item) => item.id === toId);

  if (fromIndex === -1 || toIndex === -1) {
    return items;
  }

  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function normalizePositions(items) {
  return items.map((item, index) => ({
    ...item,
    position: index + 1
  }));
}

export default function AuthorCourseContentEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuthUser({ required: true });
  const isAssistantAvailable = Boolean(user?.has_llm_api_key && user?.has_llm_folder_id);
  const toast = useToast();
  const [courseTitle, setCourseTitle] = useState("Контент курса");
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [lessonDetail, setLessonDetail] = useState(null);
  const [createLessonForm, setCreateLessonForm] = useState(emptyLesson);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [newBlockForm, setNewBlockForm] = useState(emptyBlock);
  const [blockDrafts, setBlockDrafts] = useState({});
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [draggedLessonId, setDraggedLessonId] = useState(null);
  const [lessonDropTargetId, setLessonDropTargetId] = useState(null);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [blockDropTargetId, setBlockDropTargetId] = useState(null);
  const [draggedOptionIdx, setDraggedOptionIdx] = useState(null);
  const [optionDropTargetIdx, setOptionDropTargetIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [activeMode, setActiveMode] = useState(null);
  const [authorTestCode, setAuthorTestCode] = useState({});
  const [authorTestResults, setAuthorTestResults] = useState({});
  const [isTestingCode, setIsTestingCode] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) || null;
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [chatMessages, isChatLoading]);

  const selectedBlock = useMemo(() => {
    return (lessonDetail?.blocks || []).find((block) => block.id === activeBlockId) || null;
  }, [lessonDetail, activeBlockId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourseContent() {
      setLoading(true);

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
          setCourseTitle(courseResponse.course?.title || "Контент курса");
          setLessons(lessonsResponse.lessons || []);

          if (lessonsResponse.lessons?.length) {
            setSelectedLessonId(lessonsResponse.lessons[0].id);
          }
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

    loadCourseContent();

    return () => {
      cancelled = true;
    };
  }, [params.id, toast]);

  useEffect(() => {
    if (!selectedLessonId) {
      setLessonDetail(null);
      setLessonForm(emptyLesson);
      setBlockDrafts({});
      setActiveBlockId(null);
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
          setBlockDrafts(createBlockDrafts(response.lesson.blocks || []));
          setActiveBlockId(response.lesson.blocks?.[0]?.id || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          toast.error("Не удалось загрузить урок");
        }
      }
    }

    loadLesson();

    return () => {
      cancelled = true;
    };
  }, [selectedLessonId, toast]);

  async function reloadLessons() {
    const response = await apiRequest(`/api/courses/${params.id}/lessons`, {
      headers: getAuthHeaders()
    });
    const nextLessons = response.lessons || [];
    setLessons(nextLessons);

    if (!nextLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(nextLessons[0]?.id || null);
    }

    return nextLessons;
  }

  async function reloadSelectedLesson(preferredBlockId = activeBlockId) {
    if (!selectedLessonId) {
      return null;
    }

    const response = await apiRequest(`/api/lessons/${selectedLessonId}`, {
      headers: getAuthHeaders()
    });

    const blocks = response.lesson.blocks || [];
    setLessonDetail(response.lesson);
    setLessonForm({
      title: response.lesson.title,
      position: response.lesson.position
    });
    setBlockDrafts(createBlockDrafts(blocks));
    setActiveBlockId(blocks.some((block) => block.id === preferredBlockId) ? preferredBlockId : blocks[0]?.id || null);
    return response.lesson;
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function handleLessonCreate(event) {
    event.preventDefault();
    try {
      const response = await apiRequest(`/api/courses/${params.id}/lessons`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createLessonForm,
          position: lessons.length + 1
        })
      });

      const createdLesson = response.lesson;
      setLessons((current) => [...current, createdLesson].sort((a, b) => a.position - b.position));
      setSelectedLessonId(createdLesson.id);
      setCreateLessonForm(emptyLesson);
      toast.success("Урок успешно создан");
    } catch (requestError) {
      toast.error("Не удалось создать урок");
    }
  }

  async function handleLessonUpdate(event) {
    event.preventDefault();
    if (!selectedLesson) {
      return;
    }

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
      toast.success("Урок сохранён");
    } catch (requestError) {
      toast.error("Не удалось сохранить урок");
    }
  }

  async function handleLessonDelete() {
    if (!selectedLesson) return;
    if (pendingDelete?.type !== "lesson" || pendingDelete.id !== selectedLesson.id) {
      setPendingDelete({ type: "lesson", id: selectedLesson.id });
      toast.warning("Нажмите удалить ещё раз, чтобы подтвердить");
      return;
    }

    setPendingDelete(null);

    try {
      await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      setLessons((current) => current.filter((l) => l.id !== selectedLesson.id));
      setSelectedLessonId(null);
      toast.success("Урок удалён");
    } catch (requestError) {
      toast.error("Не удалось удалить урок");
    }
  }

  async function handleNewBlockCreate(event) {
    event.preventDefault();
    if (!selectedLesson) {
      return;
    }

    try {
      const nextPosition =
        (lessonDetail?.blocks || []).reduce(
          (highestPosition, block) => Math.max(highestPosition, Number(block.position) || 0),
          0
        ) + 1;
      const response = await apiRequest(`/api/lessons/${selectedLesson.id}/blocks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newBlockForm,
          position: nextPosition
        })
      });
      const lessonResponse = await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        headers: getAuthHeaders()
      });

      setLessonDetail(lessonResponse.lesson);
      setBlockDrafts(createBlockDrafts(lessonResponse.lesson.blocks || []));
      setActiveBlockId(response.block.id);
      setNewBlockForm(emptyBlock);
      toast.success("Блок создан");
    } catch (requestError) {
      toast.error("Не удалось создать блок");
    }
  }

  async function handleBlockUpdate(blockId) {
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
      setBlockDrafts(createBlockDrafts(lessonResponse.lesson.blocks || []));
      setActiveBlockId(blockId);
      toast.success("Блок сохранён");
    } catch (requestError) {
      toast.error("Не удалось сохранить блок");
    }
  }

  async function handleBlockDelete(blockId) {
    if (pendingDelete?.type !== "block" || pendingDelete.id !== blockId) {
      setPendingDelete({ type: "block", id: blockId });
      toast.warning("Нажмите удалить ещё раз, чтобы подтвердить");
      return;
    }

    setPendingDelete(null);

    try {
      await apiRequest(`/api/blocks/${blockId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const lessonResponse = await apiRequest(`/api/lessons/${selectedLesson.id}`, {
        headers: getAuthHeaders()
      });

      setLessonDetail(lessonResponse.lesson);
      setBlockDrafts(createBlockDrafts(lessonResponse.lesson.blocks || []));
      setActiveBlockId(null);
      toast.success("Блок удалён");
    } catch (requestError) {
      toast.error("Не удалось удалить блок");
    }
  }

  function updateBlockDraft(blockId, field, value) {
    setBlockDrafts((current) => ({
      ...current,
      [blockId]: {
        ...current[blockId],
        [field]: value
      }
    }));
  }

  async function handleAuthorTestSubmit(blockId) {
    const draft = blockDrafts[blockId];
    if (!draft || !draft.quiz_data || !authorTestCode[blockId]) return;

    setIsTestingCode((prev) => ({ ...prev, [blockId]: true }));
    setAuthorTestResults((prev) => ({ ...prev, [blockId]: null }));

    try {
      const response = await apiRequest("/api/run-tests", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          language: draft.quiz_data.language || "javascript",
          code: authorTestCode[blockId],
          test_cases: draft.quiz_data.test_cases || [],
          function_name: draft.quiz_data.function_name || ""
        })
      });

      setAuthorTestResults((prev) => ({ ...prev, [blockId]: response }));
      if (["passed", "accepted"].includes(response.status)) {
        toast.success("Тесты успешно пройдены");
      } else {
        toast.error("Тесты не пройдены");
      }
    } catch (err) {
      setAuthorTestResults((prev) => ({
        ...prev,
        [blockId]: {
          status: "failed",
          result_message: err.message || "Ошибка выполнения",
          tests_result: null
        }
      }));
      toast.error("Ошибка выполнения кода");
    } finally {
      setIsTestingCode((prev) => ({ ...prev, [blockId]: false }));
    }
  }

  async function handleLessonDrop(targetLessonId) {
    if (!draggedLessonId || draggedLessonId === targetLessonId) {
      setDraggedLessonId(null);
      setLessonDropTargetId(null);
      return;
    }

    const previousLessons = lessons;
    const reorderedLessons = normalizePositions(moveItem(lessons, draggedLessonId, targetLessonId));
    setDraggedLessonId(null);
    setLessonDropTargetId(null);
    setLessons(reorderedLessons);
    setLessonForm((current) =>
      selectedLessonId ? { ...current, position: reorderedLessons.find((lesson) => lesson.id === selectedLessonId)?.position || current.position } : current
    );
    toast.info("Сохраняем порядок уроков...");

    try {
      await Promise.all(
        reorderedLessons.map((lesson) =>
          apiRequest(`/api/lessons/${lesson.id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              title: lesson.title,
              position: lesson.position
            })
          })
        )
      );
      toast.success("Порядок уроков сохранён");
    } catch (requestError) {
      setLessons(previousLessons);
      toast.error("Не удалось сохранить порядок уроков");
      try {
        await reloadLessons();
      } catch {
        // Keep the original error visible; the next manual action can retry loading.
      }
    }
  }

  async function handleBlockDrop(targetBlockId) {
    if (!draggedBlockId || draggedBlockId === targetBlockId || !lessonDetail) {
      setDraggedBlockId(null);
      setBlockDropTargetId(null);
      return;
    }

    const previousLessonDetail = lessonDetail;
    const reorderedBlocks = normalizePositions(moveItem(lessonDetail.blocks || [], draggedBlockId, targetBlockId));
    setDraggedBlockId(null);
    setBlockDropTargetId(null);
    setLessonDetail({
      ...lessonDetail,
      blocks: reorderedBlocks
    });
    setBlockDrafts((current) => ({
      ...current,
      ...Object.fromEntries(
        reorderedBlocks.map((block) => [
          block.id,
          {
            ...(current[block.id] || block),
            position: block.position
          }
        ])
      )
    }));
    toast.info("Сохраняем порядок блоков...");

    try {
      await Promise.all(
        reorderedBlocks.map((block) => {
          const draft = {
            ...block,
            ...(blockDrafts[block.id] || {})
          };

          return apiRequest(`/api/blocks/${block.id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              type: draft.type,
              title: draft.title,
              content: draft.content,
              attachment_url: draft.attachment_url,
              position: block.position,
              quiz_data: draft.quiz_data
            })
          });
        })
      );
      toast.success("Порядок блоков сохранён");
    } catch (requestError) {
      setLessonDetail(previousLessonDetail);
      setBlockDrafts(createBlockDrafts(previousLessonDetail.blocks || []));
      toast.error("Не удалось сохранить порядок блоков");
      try {
        await reloadSelectedLesson(activeBlockId);
      } catch {
        // Keep the original error visible; the next manual action can retry loading.
      }
    }
  }

  function handleOptionDrop(targetIdx) {
    if (draggedOptionIdx === null || draggedOptionIdx === targetIdx || !selectedBlock) {
      setDraggedOptionIdx(null);
      setOptionDropTargetIdx(null);
      return;
    }

    const currentOptions = blockDrafts[selectedBlock.id]?.quiz_data?.options || [];
    const nextOptions = [...currentOptions];
    const [movedItem] = nextOptions.splice(draggedOptionIdx, 1);
    nextOptions.splice(targetIdx, 0, movedItem);

    updateBlockDraft(selectedBlock.id, "quiz_data", {
      ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
      options: nextOptions
    });

    setDraggedOptionIdx(null);
    setOptionDropTargetIdx(null);
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
      const editorContext = lessonDetail
        ? `Автор редактирует урок: "${lessonDetail.title}".\nТекущие блоки урока:\n` + (lessonDetail.blocks || []).map(b => `[${b.type}] ${b.title}: ${b.content}`).join('\n')
        : "Автор пока не выбрал урок.";
      console.log("[ChatRequest]", { userInput: userText, mode: activeMode });

      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userInput: userText,
          lessonContext: editorContext,
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
      title={courseTitle}
      user={user}
      onLogout={handleLogout}
    >
      <div className="author-content-actions">
        <Link className="secondary-link-button" to={`/author/courses/${params.id}/edit`}>
          На страницу курса
        </Link>
        <Link className="secondary-link-button" to="/author/dashboard">
          Назад в панель
        </Link>
      </div>

      {loading ? <p>Загрузка контента курса...</p> : null}

      {!loading ? (
        <section className="author-editor-layout">
          <aside className="author-lessons-sidebar" aria-label="Course lessons">
            <div className="author-panel-header">
              <span className="eyebrow">Карта курса</span>
              <h2>Уроки</h2>
            </div>

            <div className="stack-list" style={{ marginTop: '1rem' }}>
              {lessons.map((lesson, index) => {
                const displayPosition = index + 1;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    draggable
                    className={[
                      "lesson-link-card button-card",
                      lesson.id === selectedLessonId ? "active" : "",
                      lesson.id === draggedLessonId ? "dragging" : "",
                      lesson.id === lessonDropTargetId ? "drop-target" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedLessonId(lesson.id);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (draggedLessonId && draggedLessonId !== lesson.id) {
                        setLessonDropTargetId(lesson.id);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDragLeave={() => {
                      if (lessonDropTargetId === lesson.id) {
                        setLessonDropTargetId(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleLessonDrop(lesson.id);
                    }}
                    onDragEnd={() => {
                      setDraggedLessonId(null);
                      setLessonDropTargetId(null);
                    }}
                    onClick={() => setSelectedLessonId(lesson.id)}
                  >
                    <span className="lesson-number">{displayPosition}</span>
                    <strong>
                      {lesson.title}
                    </strong>
                  </button>
                );
              })}
            </div>

            <form className="author-create-lesson form compact-form" onSubmit={handleLessonCreate}>
              <h3>Добавить урок</h3>
              <label>
                <span>Название</span>
                <input
                  value={createLessonForm.title}
                  onChange={(event) =>
                    setCreateLessonForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <button type="submit">Добавить урок</button>
            </form>
          </aside>

          <main className="author-workspace">
            {selectedLesson && lessonDetail ? (
              <>
                <form className="author-lesson-bar" onSubmit={handleLessonUpdate}>
                  <div className="author-panel-header">
                    <span className="eyebrow">Выбранный урок</span>
                    <h2>{selectedLesson.title}</h2>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>Название</span>
                      <input
                        value={lessonForm.title}
                        onChange={(event) =>
                          setLessonForm((current) => ({ ...current, title: event.target.value }))
                        }
                        required
                        style={{ width: "100%" }}
                      />
                    </label>
                    <button type="submit" style={{ height: "fit-content" }}>Сохранить урок</button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleLessonDelete}
                      style={{ height: "fit-content", backgroundColor: "#ec4899", color: "#fff", borderColor: "#ec4899" }}
                      title="Удалить урок со всеми блоками"
                    >
                      Удалить
                    </button>
                  </div>
                </form>

                <form className="author-create-block" onSubmit={handleNewBlockCreate}>
                  <div className="block-type-picker" role="group" aria-label="New block type">
                    {["lecture", "practice", "test"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={newBlockForm.type === type ? "active" : ""}
                        onClick={() => setNewBlockForm((current) => ({ ...current, type }))}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <label>
                    <span>Название нового блока</span>
                    <input
                      value={newBlockForm.title}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Название задания"
                      required
                    />
                  </label>
                  <label>
                    <span>URL вложения</span>
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
                  <button type="submit">Добавить блок</button>
                </form>

                <div className="author-block-area">
                  <div className="author-block-list" aria-label="Lesson blocks">
                    {lessonDetail.blocks.length ? (
                      lessonDetail.blocks.map((block) => (
                        <button
                          key={block.id}
                          type="button"
                          draggable
                          className={[
                            block.id === activeBlockId ? "active" : "",
                            block.id === draggedBlockId ? "dragging" : "",
                            block.id === blockDropTargetId ? "drop-target" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            setDraggedBlockId(block.id);
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            if (draggedBlockId && draggedBlockId !== block.id) {
                              setBlockDropTargetId(block.id);
                            }
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDragLeave={() => {
                            if (blockDropTargetId === block.id) {
                              setBlockDropTargetId(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleBlockDrop(block.id);
                          }}
                          onDragEnd={() => {
                            setDraggedBlockId(null);
                            setBlockDropTargetId(null);
                          }}
                          onClick={() => setActiveBlockId(block.id)}
                        >
                          <span className="tag-chip">{blockDrafts[block.id]?.type || block.type}</span>
                          <strong>{blockDrafts[block.id]?.title || block.title}</strong>
                          <span>#{block.id}</span>
                        </button>
                      ))
                    ) : (
                      <p className="helper-text">Блоков пока нет. Добавьте лекцию, практику или тест выше.</p>
                    )}
                  </div>

                  {selectedBlock ? (
                    <form
                      className="author-block-editor"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleBlockUpdate(selectedBlock.id);
                      }}
                    >
                      <div className="author-block-editor-header">
                        <div>
                          <span className="eyebrow">Редактирование блока #{selectedBlock.id}</span>
                          <h3>{blockDrafts[selectedBlock.id]?.title || selectedBlock.title}</h3>
                        </div>
                      </div>

                      <div className="block-type-picker" role="group" aria-label="Block type">
                        {["lecture", "practice", "test"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={(blockDrafts[selectedBlock.id]?.type || selectedBlock.type) === type ? "active" : ""}
                            onClick={() => updateBlockDraft(selectedBlock.id, "type", type)}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      <div className="author-field-grid">
                        <label>
                          <span>Название</span>
                          <input
                            value={blockDrafts[selectedBlock.id]?.title || ""}
                            onChange={(event) => updateBlockDraft(selectedBlock.id, "title", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>URL вложения</span>
                          <input
                            value={blockDrafts[selectedBlock.id]?.attachment_url || ""}
                            onChange={(event) =>
                              updateBlockDraft(selectedBlock.id, "attachment_url", event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <label className="author-content-field">
                        <span>Контент</span>
                        <textarea
                          rows="14"
                          value={blockDrafts[selectedBlock.id]?.content || ""}
                          onChange={(event) => updateBlockDraft(selectedBlock.id, "content", event.target.value)}
                        />
                      </label>

                      {blockDrafts[selectedBlock.id]?.type === "test" && (
                        <div className="author-quiz-editor" style={{ marginTop: "1rem", padding: "1.5rem", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: "8px", background: "#fff" }}>
                          <div className="author-panel-header" style={{ marginBottom: "1rem" }}>
                            <span className="eyebrow">Интерактивное задание</span>
                            <h4>Опрос / Тестирование</h4>
                          </div>

                          <label style={{ display: "block", marginBottom: "1.5rem" }}>
                            <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Тип выбора</span>
                            <select
                              value={blockDrafts[selectedBlock.id]?.quiz_data?.quiz_type || "single"}
                              onChange={(e) => updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
                                quiz_type: e.target.value
                              })}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                            >
                              <option value="single">Одиночный (Радиокнопки)</option>
                              <option value="multiple">Множественный (Чекбоксы)</option>
                            </select>
                          </label>

                          <div className="quiz-options-list">
                            <span style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Варианты ответов</span>
                            {(blockDrafts[selectedBlock.id]?.quiz_data?.options || []).map((opt, idx) => (
                              <div
                                key={idx}
                                className="quiz-option-item"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = "move";
                                  setDraggedOptionIdx(idx);
                                }}
                                onDragEnter={(event) => {
                                  event.preventDefault();
                                  if (draggedOptionIdx !== null && draggedOptionIdx !== idx) {
                                    setOptionDropTargetIdx(idx);
                                  }
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                }}
                                onDragLeave={() => {
                                  if (optionDropTargetIdx === idx) {
                                    setOptionDropTargetIdx(null);
                                  }
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  handleOptionDrop(idx);
                                }}
                                onDragEnd={() => {
                                  setDraggedOptionIdx(null);
                                  setOptionDropTargetIdx(null);
                                }}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "auto auto 1fr 1fr auto",
                                  gap: "0.75rem",
                                  alignItems: "center",
                                  marginBottom: "0.75rem",
                                  padding: "0.75rem",
                                  background: idx === optionDropTargetIdx ? "#eaf2ff" : "var(--surface-color, #f8fafc)",
                                  borderRadius: "6px",
                                  border: `1px solid ${idx === optionDropTargetIdx ? "#0b63f6" : "#e2e8f0"}`,
                                  opacity: idx === draggedOptionIdx ? 0.5 : 1,
                                  transition: "all 0.2s ease"
                                }}
                              >
                                <div style={{ cursor: "grab", color: "#94a3b8", paddingRight: "4px", userSelect: "none" }} title="Перетащить">⋮⋮</div>
                                <input
                                  type={blockDrafts[selectedBlock.id]?.quiz_data?.quiz_type === "multiple" ? "checkbox" : "radio"}
                                  checked={opt.is_correct || false}
                                  onChange={(e) => {
                                    const newOptions = [...(blockDrafts[selectedBlock.id]?.quiz_data?.options || [])];
                                    if (blockDrafts[selectedBlock.id]?.quiz_data?.quiz_type === "single") {
                                      newOptions.forEach(o => o.is_correct = false);
                                    }
                                    newOptions[idx].is_correct = e.target.checked;
                                    updateBlockDraft(selectedBlock.id, "quiz_data", {
                                      ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
                                      options: newOptions
                                    });
                                  }}
                                  title="Отметить как правильный"
                                  style={{ width: "1.2rem", height: "1.2rem", cursor: "pointer" }}
                                />
                                <input
                                  type="text"
                                  placeholder="Текст ответа"
                                  value={opt.text || ""}
                                  onChange={(e) => {
                                    const newOptions = [...(blockDrafts[selectedBlock.id]?.quiz_data?.options || [])];
                                    newOptions[idx].text = e.target.value;
                                    updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), options: newOptions });
                                  }}
                                  style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
                                />
                                <input
                                  type="text"
                                  placeholder="Подсказка (если выберут ошибку)"
                                  value={opt.hint || ""}
                                  onChange={(e) => {
                                    const newOptions = [...(blockDrafts[selectedBlock.id]?.quiz_data?.options || [])];
                                    newOptions[idx].hint = e.target.value;
                                    updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), options: newOptions });
                                  }}
                                  style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%" }}
                                />
                                <button type="button" className="secondary-button" onClick={() => {
                                  const newOptions = blockDrafts[selectedBlock.id].quiz_data.options.filter((_, i) => i !== idx);
                                  updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), options: newOptions });
                                }} style={{ padding: "0.5rem", color: "var(--error-color, #ef4444)", borderColor: "#e2e8f0" }} title="Удалить вариант">✕</button>
                              </div>
                            ))}
                            <button type="button" className="secondary-button" onClick={() => {
                              const currentData = blockDrafts[selectedBlock.id]?.quiz_data || { quiz_type: 'single', options: [] };
                              const safeOptions = Array.isArray(currentData.options) ? currentData.options : [];
                              updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...currentData,
                                options: [...safeOptions, { text: "", is_correct: false, hint: "" }]
                              });
                            }} style={{ marginTop: "0.5rem" }}>+ Добавить вариант</button>
                          </div>
                        </div>
                      )}

                      {blockDrafts[selectedBlock.id]?.type === "practice" && (
                        <div className="author-practice-editor" style={{ marginTop: "1rem", padding: "1.5rem", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: "8px", background: "#fff" }}>
                          <div className="author-panel-header" style={{ marginBottom: "1rem" }}>
                            <span className="eyebrow">Интерактивное задание</span>
                            <h4>Настройки задания с кодом</h4>
                          </div>

                          <label style={{ display: "block", marginBottom: "1.5rem" }}>
                            <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Язык программирования</span>
                            <select
                              value={blockDrafts[selectedBlock.id]?.quiz_data?.language || "javascript"}
                              onChange={(e) => updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
                                task_type: "code",
                                language: e.target.value
                              })}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                            >
                              <option value="javascript">JavaScript</option>
                              <option value="python">Python</option>
                              <option value="java">Java</option>
                              <option value="c++">C++</option>
                            </select>
                          </label>

                          <label style={{ display: "block", marginBottom: "1.5rem" }}>
                            <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Имя проверяемой функции (опционально)</span>
                            <input
                              type="text"
                              placeholder="например, sum"
                              value={blockDrafts[selectedBlock.id]?.quiz_data?.function_name || ""}
                              onChange={(e) => updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
                                task_type: "code",
                                function_name: e.target.value
                              })}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                            />
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Если указано, система сама вызовет эту функцию (только для JS и Python).</span>
                          </label>

                          <div style={{ marginBottom: "1.5rem" }}>
                            <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Стартовый код для студента</span>
                            <CodeEditor
                              value={blockDrafts[selectedBlock.id]?.quiz_data?.placeholder_code || ""}
                              onChange={(val) => updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...(blockDrafts[selectedBlock.id]?.quiz_data || {}),
                                task_type: "code",
                                placeholder_code: val
                              })}
                              language={blockDrafts[selectedBlock.id]?.quiz_data?.language || "javascript"}
                              height={150}
                            />
                          </div>

                          <div className="quiz-options-list" style={{ marginBottom: "2rem" }}>
                            <span style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Test Benches (Тест-кейсы)</span>
                            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>Добавьте входные данные (stdin) и ожидаемый вывод (stdout). Важно точное совпадение!</p>
                            {(blockDrafts[selectedBlock.id]?.quiz_data?.test_cases || []).map((tc, idx) => (
                              <div
                                key={idx}
                                className="quiz-option-item"
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr auto",
                                  gap: "0.75rem",
                                  alignItems: "start",
                                  marginBottom: "0.75rem",
                                  padding: "1rem",
                                  background: "var(--surface-color, #f8fafc)",
                                  borderRadius: "6px",
                                  border: "1px solid #e2e8f0"
                                }}
                              >
                                <label style={{ marginBottom: 0 }}>
                                  <span style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#64748b" }}>Входные данные (stdin)</span>
                                  <textarea
                                    rows="2"
                                    placeholder="1 2 3"
                                    value={tc.input || ""}
                                    onChange={(e) => {
                                      const newTestCases = [...(blockDrafts[selectedBlock.id]?.quiz_data?.test_cases || [])];
                                      newTestCases[idx].input = e.target.value;
                                      updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), task_type: "code", test_cases: newTestCases });
                                    }}
                                    style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%", resize: "vertical" }}
                                  />
                                </label>
                                <label style={{ marginBottom: 0 }}>
                                  <span style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#64748b" }}>Ожидаемый вывод (stdout)</span>
                                  <textarea
                                    rows="2"
                                    placeholder="6"
                                    value={tc.expected_output || ""}
                                    onChange={(e) => {
                                      const newTestCases = [...(blockDrafts[selectedBlock.id]?.quiz_data?.test_cases || [])];
                                      newTestCases[idx].expected_output = e.target.value;
                                      updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), task_type: "code", test_cases: newTestCases });
                                    }}
                                    style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%", resize: "vertical" }}
                                  />
                                </label>
                                <button type="button" className="secondary-button" onClick={() => {
                                  const newTestCases = blockDrafts[selectedBlock.id].quiz_data.test_cases.filter((_, i) => i !== idx);
                                  updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), task_type: "code", test_cases: newTestCases });
                                }} style={{ padding: "0.5rem", color: "var(--error-color, #ef4444)", borderColor: "#e2e8f0" }} title="Удалить тест-кейс">✕</button>
                              </div>
                            ))}
                            <button type="button" className="secondary-button" onClick={() => {
                              const currentData = blockDrafts[selectedBlock.id]?.quiz_data || { task_type: "code", language: "javascript", test_cases: [] };
                              const safeTestCases = Array.isArray(currentData.test_cases) ? currentData.test_cases : [];
                              updateBlockDraft(selectedBlock.id, "quiz_data", {
                                ...currentData,
                                task_type: "code",
                                test_cases: [...safeTestCases, { input: "", expected_output: "", is_hidden: false }]
                              });
                            }} style={{ marginTop: "0.5rem" }}>+ Добавить тест-кейс</button>
                          </div>

                          <div className="author-test-panel" style={{ padding: "1rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                            <h5 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "#334155" }}>Тестирование задания</h5>
                            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>Напишите эталонное решение, чтобы проверить корректность тест-кейсов.</p>
                            <div style={{ marginBottom: "1rem" }}>
                              <CodeEditor
                                value={authorTestCode[selectedBlock.id] || blockDrafts[selectedBlock.id]?.quiz_data?.placeholder_code || ""}
                                onChange={(val) => setAuthorTestCode(prev => ({ ...prev, [selectedBlock.id]: val }))}
                                language={blockDrafts[selectedBlock.id]?.quiz_data?.language || "javascript"}
                                height={200}
                              />
                            </div>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleAuthorTestSubmit(selectedBlock.id)}
                              disabled={isTestingCode[selectedBlock.id]}
                            >
                              {isTestingCode[selectedBlock.id] ? "Проверка..." : "Запустить тесты"}
                            </button>

                            {authorTestResults[selectedBlock.id] && (
                              <div style={{ marginTop: "1rem" }}>
                                <div className={`check-result ${authorTestResults[selectedBlock.id].status === "passed" || authorTestResults[selectedBlock.id].status === "accepted" ? "success-result" : "error-result"}`} style={{ padding: "1rem", borderRadius: "6px", border: "1px solid", borderColor: authorTestResults[selectedBlock.id].status === "passed" || authorTestResults[selectedBlock.id].status === "accepted" ? "#86efac" : "#fca5a5", background: authorTestResults[selectedBlock.id].status === "passed" || authorTestResults[selectedBlock.id].status === "accepted" ? "#f0fdf4" : "#fef2f2" }}>
                                  <span style={{ fontWeight: "bold", color: authorTestResults[selectedBlock.id].status === "passed" || authorTestResults[selectedBlock.id].status === "accepted" ? "#166534" : "#991b1b" }}>{authorTestResults[selectedBlock.id].status || "Результат"}</span>
                                  <p style={{ margin: "0.5rem 0", color: authorTestResults[selectedBlock.id].status === "passed" || authorTestResults[selectedBlock.id].status === "accepted" ? "#15803d" : "#b91c1c" }}>{authorTestResults[selectedBlock.id].result_message}</p>
                                  {authorTestResults[selectedBlock.id].tests_result ? (
                                    <div className="test-stats" style={{ marginTop: "1rem" }}>
                                      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontSize: "0.85rem", fontWeight: "bold" }}>
                                        <span>Всего: {authorTestResults[selectedBlock.id].tests_result.total}</span>
                                        <span style={{ color: "#10b981" }}>Успешно: {authorTestResults[selectedBlock.id].tests_result.passed}</span>
                                        <span style={{ color: "#ef4444" }}>Упало: {authorTestResults[selectedBlock.id].tests_result.failed}</span>
                                      </div>

                                      {(authorTestResults[selectedBlock.id].tests_result.details || []).map((detail, idx) => (
                                        <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "4px", background: detail.passed ? "#f0fdf4" : "#fff" }}>
                                          <div style={{ fontWeight: "bold", marginBottom: "0.5rem", fontSize: "0.85rem", color: detail.passed ? "#15803d" : "#b91c1c" }}>
                                            Тест #{idx + 1} {detail.passed ? "✓ Пройден" : "✗ Упал"}
                                          </div>
                                          {!detail.passed && (
                                            <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.5rem" }}>
                                              <div><strong style={{ color: "#64748b" }}>Ввод (stdin):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px" }}>{detail.input}</pre></div>
                                              <div><strong style={{ color: "#64748b" }}>Ожидалось (stdout):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px" }}>{detail.expected}</pre></div>
                                              <div><strong style={{ color: "#64748b" }}>Реальный вывод:</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", color: "#b91c1c" }}>{detail.actual}</pre></div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="action-row" style={{ marginTop: "1.5rem" }}>
                        <button
                          type="submit"
                        >
                          Сохранить изменения
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleBlockDelete(selectedBlock.id)}
                          style={{ backgroundColor: "#ec4899", color: "#fff", borderColor: "#ec4899" }}
                          title="Удалить блок"
                        >
                          Удалить
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="author-empty-state">
                <p>Создайте урок, чтобы начать наполнение курса контентом.</p>
              </div>
            )}
          </main>

          <aside className="author-assistant-panel" aria-label="Course assistant" style={{ display: "flex", flexDirection: "column" }}>
            <div className="author-panel-header">
              <span className="eyebrow">Ассистент</span>
              <h2>Чат по курсу</h2>
            </div>

            <div className="chat-quick-actions">
              {AUTHOR_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => isAssistantAvailable && setActiveMode(activeMode === mode.id ? null : mode.id)}
                  disabled={!isAssistantAvailable}
                  style={{
                    fontSize: "0.75rem",
                    minHeight: "38px",
                    padding: "0.45rem 0.55rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: activeMode === mode.id ? "var(--primary-color, #0284c7)" : "transparent",
                    color: activeMode === mode.id ? "#fff" : (isAssistantAvailable ? "inherit" : "var(--text-muted, #94a3b8)"),
                    cursor: isAssistantAvailable ? "pointer" : "not-allowed",
                    whiteSpace: "normal",
                    lineHeight: 1.2
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="chat-history" style={{ flex: 1, overflowY: "auto", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chatMessages.length === 0 ? (
                <div className="author-assistant-placeholder">
                  {isAssistantAvailable ? (
                    <p>{AUTHOR_MODE_DESCRIPTIONS[activeMode || "default"]}</p>
                  ) : (
                    <AssistantUnavailableNotice />
                  )}
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.role}`} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? "var(--surface-color, #f1f5f9)" : "var(--primary-light, #e0f2fe)", padding: "0.75rem", borderRadius: "8px", maxWidth: "90%", marginRight: msg.role === "user" ? "0.5rem" : "0" }}>
                    {msg.role === "user" && (
                      <strong style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>{user?.name || "You"}</strong>
                    )}
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
              {isChatLoading && <div className="chat-message assistant" style={{ alignSelf: "flex-start", padding: "0.75rem", color: "var(--text-muted, #64748b)" }}>Печатает...</div>}
              <div ref={chatEndRef} />
            </div>

            <form className="assistant-input-row" onSubmit={handleChatSubmit}>
              <AssistantTextarea
                value={chatInput}
                onChange={setChatInput}
                onSubmit={() => handleChatSubmit()}
                placeholder={isAssistantAvailable ? "Например:\nУлучши объяснение выбранного блока\nПридумай практическое задание по теме" : "Чат недоступен. Добавьте API ключ и Folder ID."}
                disabled={isChatLoading || !isAssistantAvailable}
              />
              <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim() || !isAssistantAvailable}>
                Отправить
              </button>
            </form>
          </aside>
        </section>
      ) : null}
    </AppLayout>
  );
}
