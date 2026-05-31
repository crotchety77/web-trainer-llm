import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import CodeTaskEditor from "../components/CodeTaskEditor";
import AIChatPanel from "../components/AIChatPanel";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiFormRequest, apiRequest, getApiUrl } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";
import { buildAuthorStepsContext, buildLessonSummaryContext } from "../utils/aiContextBuilders";
import { extractStepRefs } from "../utils/extractStepRefs";

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

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".docx"];

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
    // Existing data may contain one plain URL instead of JSON metadata.
  }

  return [{ original_name: "Прикрепленный файл", url: value, stored_name: "", size: 0 }];
}

function getAttachmentHref(url) {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }

  return `${getApiUrl()}${url}`;
}

function formatFileSize(bytes = 0) {
  if (!bytes) {
    return "";
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

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
  const chatLoadedRef = useRef({ userId: null, courseId: null });
  const [activeMode, setActiveMode] = useState(null);
  const detectedStepRefs = useMemo(() => extractStepRefs(chatInput), [chatInput]);
  const [authorTestCode, setAuthorTestCode] = useState({});
  const [authorTestResults, setAuthorTestResults] = useState({});
  const [isTestingCode, setIsTestingCode] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [attachmentUploadState, setAttachmentUploadState] = useState({});

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) || null;
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [chatMessages, isChatLoading]);

  // Load chat history from localStorage
  useEffect(() => {
    const courseId = params.id;
    if (user?.id && courseId) {
      if (chatLoadedRef.current.userId !== user.id || chatLoadedRef.current.courseId !== courseId) {
        const saved = localStorage.getItem(`chat_history_${user.id}_course_content_${courseId}`);
        if (saved) {
          try {
            setChatMessages(JSON.parse(saved));
          } catch (e) {
            console.error("Failed to parse saved chat history:", e);
            setChatMessages([]);
          }
        } else {
          setChatMessages([]);
        }
        chatLoadedRef.current = { userId: user.id, courseId };
      }
    } else {
      setChatMessages([]);
      chatLoadedRef.current = { userId: null, courseId: null };
    }
  }, [user?.id, params.id]);

  // Save chat history to localStorage
  useEffect(() => {
    const courseId = params.id;
    if (user?.id && courseId && chatLoadedRef.current.userId === user.id && chatLoadedRef.current.courseId === courseId) {
      if (chatMessages.length > 0) {
        localStorage.setItem(`chat_history_${user.id}_course_content_${courseId}`, JSON.stringify(chatMessages));
      } else {
        localStorage.removeItem(`chat_history_${user.id}_course_content_${courseId}`);
      }
    }
  }, [chatMessages, user?.id, params.id]);

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

  async function handleLessonDelete(lessonId = null) {
    const targetId = lessonId || selectedLesson?.id;
    if (!targetId) return;

    if (pendingDelete?.type !== "lesson" || pendingDelete.id !== targetId) {
      setPendingDelete({ type: "lesson", id: targetId });
      toast.warning("Нажмите удалить ещё раз, чтобы подтвердить");
      return;
    }

    setPendingDelete(null);

    try {
      await apiRequest(`/api/lessons/${targetId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      setLessons((current) => current.filter((l) => l.id !== targetId));
      if (selectedLessonId === targetId) {
        setSelectedLessonId(null);
      }
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

  async function handleAttachmentUpload(blockId, file) {
    if (!file) {
      return;
    }

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      toast.error("Можно загрузить только PDF или DOCX");
      return;
    }

    if (file.size >= MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error("Файл должен быть меньше 20 МБ");
      return;
    }

    setAttachmentUploadState((current) => ({ ...current, [blockId]: { uploading: true } }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiFormRequest(`/api/blocks/${blockId}/attachments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData
      });

      await reloadSelectedLesson(blockId);
      toast.success("Файл прикреплен");
    } catch (requestError) {
      toast.error(requestError.message || "Не удалось загрузить файл");
    } finally {
      setAttachmentUploadState((current) => ({ ...current, [blockId]: { uploading: false } }));
    }
  }

  async function handleAttachmentDelete(blockId, storedName) {
    if (!storedName) {
      updateBlockDraft(blockId, "attachment_url", "");
      return;
    }

    try {
      await apiRequest(`/api/blocks/${blockId}/attachments/${encodeURIComponent(storedName)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      await reloadSelectedLesson(blockId);
      toast.success("Файл удален");
    } catch (requestError) {
      toast.error(requestError.message || "Не удалось удалить файл");
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
    if (!draft || !draft.quiz_data) {
      toast.error("Ошибка: Данные интерактивного задания не инициализированы.");
      return;
    }

    const codeToRun = authorTestCode[blockId] !== undefined
      ? authorTestCode[blockId]
      : (draft.quiz_data.placeholder_code || "");

    if (!codeToRun || !codeToRun.trim()) {
      toast.warning("Пожалуйста, напишите или отредактируйте код решения перед запуском тестов!");
      return;
    }

    const testCases = draft.quiz_data.test_cases || [];
    if (testCases.length === 0) {
      toast.warning("Добавьте хотя бы один тест-кейс в настройках задания перед проверкой.");
      return;
    }

    setIsTestingCode((prev) => ({ ...prev, [blockId]: true }));
    setAuthorTestResults((prev) => ({ ...prev, [blockId]: null }));

    try {
      const response = await apiRequest("/api/run-tests", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          language: draft.quiz_data.language || "javascript",
          code: codeToRun,
          test_cases: testCases,
          function_name: draft.quiz_data.function_name || ""
        })
      });

      setAuthorTestResults((prev) => ({ ...prev, [blockId]: response }));
      if (["passed", "accepted"].includes(response.status)) {
        toast.success("Тесты успешно пройдены");
      } else {
        toast.error("Тесты не пройдены: проверьте сообщения об ошибках");
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
      toast.error(`Ошибка при проверке кода: ${err.message || "Не удалось отправить запрос"}`);
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
      const summaryContext = buildLessonSummaryContext(lessonDetail, lessonDetail?.blocks || []);
      const stepsContext = buildAuthorStepsContext({
        text: userText,
        sortedBlocks: lessonDetail?.blocks || [],
        blockDrafts,
        authorTestCode
      });

      const editorContext = lessonDetail
        ? `Автор редактирует урок: "${lessonDetail.title}".\n\n${summaryContext}`
        : "Автор пока не выбрал урок.";

      console.log("[ChatRequest]", { userInput: userText, mode: activeMode, stepsContext });

      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userInput: userText,
          lessonContext: editorContext,
          stepsContext: stepsContext,
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
      user={user}
      onLogout={handleLogout}
    >

      <div className="author-content-actions" style={{ paddingTop: "1rem" }}>
        <Link className="secondary-link-button" to="/author/dashboard">
          Назад
        </Link>
        <Link className="secondary-link-button" to={`/author/courses/${params.id}/edit`}>
          Редактировать визитку курса
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
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", overflow: "hidden", gap: "4px", paddingRight: "4px" }}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", minWidth: 0, flex: 1 }}>
                      <span className="lesson-number">{displayPosition}</span>
                      <strong
                        style={{
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          display: "inline-block",
                          flex: 1,
                          textAlign: "left"
                        }}
                        title={lesson.title}
                      >
                        {lesson.title}
                      </strong>
                    </div>
                    {(() => {
                      const isPendingConfirm = pendingDelete?.type === "lesson" && pendingDelete.id === lesson.id;
                      return (
                        <span
                          role="button"
                          tabIndex={0}
                          className="lesson-delete-icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleLessonDelete(lesson.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.stopPropagation();
                              handleLessonDelete(lesson.id);
                            }
                          }}
                          style={{
                            background: isPendingConfirm ? "#fee2e2" : "none",
                            border: "none",
                            padding: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isPendingConfirm ? "#ef4444" : "#94a3b8",
                            borderRadius: "6px",
                            transition: "color 0.2s, background-color 0.2s",
                            marginLeft: "auto",
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            if (!isPendingConfirm) {
                              e.currentTarget.style.color = "#ef4444";
                              e.currentTarget.style.background = "#fee2e2";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isPendingConfirm) {
                              e.currentTarget.style.color = "#94a3b8";
                              e.currentTarget.style.background = "none";
                            }
                          }}
                          title={isPendingConfirm ? "Нажмите еще раз для подтверждения" : "Удалить урок"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </span>
                      );
                    })()}
                  </button>
                );
              })}
            </div>

            <form className="author-create-lesson form compact-form" onSubmit={handleLessonCreate}>
              <h3>Добавить урок</h3>
              <label>
                <input
                  placeholder="Название"
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
                  <div className="author-panel-name" style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      <span style={{ display: "block", marginBottom: "0.25rem" }}>Редактировать название урока</span>
                      <input
                        value={lessonForm.title}
                        onChange={(event) =>
                          setLessonForm((current) => ({ ...current, title: event.target.value }))
                        }
                        required
                        style={{ width: "100%", minWidth: "200px" }}
                      />
                    </label>
                    <button type="submit" style={{ height: "fit-content" }}>Сохранить</button>
                  </div>
                </form>

                <form className="author-create-block" onSubmit={handleNewBlockCreate}>
                  <div>
                    <span style={{ display: "block", marginBottom: "10px", fontSize: "13px", fontWeight: "700", color: "var(--text-muted, #475569)" }}>Тип блока</span>
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
                  </div>
                  <div className="author-panel-name" style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      <span style={{ display: "block", marginBottom: "0.25rem" }}>Создание нового блока</span>
                      <input
                        value={newBlockForm.title}
                        onChange={(event) =>
                          setNewBlockForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Название нового блока"
                        required
                        style={{ width: "100%", minWidth: "200px" }}
                      />
                    </label>
                    <button type="submit" style={{ height: "fit-content", whiteSpace: "nowrap" }}>Добавить блок</button>
                  </div>
                </form>

                <div className="author-block-area">
                  <div className="author-block-list" aria-label="Lesson blocks">
                    {lessonDetail.blocks.length ? (
                      lessonDetail.blocks.map((block, index) => (
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
                          <span className="tag-chip" style={{ alignSelf: "center", height: "fit-content", width: "fit-content" }}>
                            {blockDrafts[block.id]?.type || block.type}
                          </span>
                          <strong>
                            {blockDrafts[block.id]?.title || block.title}
                          </strong>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ color: "#94a3b8", fontSize: "0.85rem", flexShrink: 0 }}>#{index + 1}</span>
                            {(() => {
                              const isPendingConfirm = pendingDelete?.type === "block" && pendingDelete.id === block.id;
                              return (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="block-delete-icon-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleBlockDelete(block.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.stopPropagation();
                                      handleBlockDelete(block.id);
                                    }
                                  }}
                                  style={{
                                    background: isPendingConfirm ? "#fee2e2" : "none",
                                    border: "none",
                                    padding: "6px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: isPendingConfirm ? "#ef4444" : "#94a3b8",
                                    borderRadius: "6px",
                                    transition: "color 0.2s, background-color 0.2s",
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isPendingConfirm) {
                                      e.currentTarget.style.color = "#ef4444";
                                      e.currentTarget.style.background = "#fee2e2";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isPendingConfirm) {
                                      e.currentTarget.style.color = "#94a3b8";
                                      e.currentTarget.style.background = "none";
                                    }
                                  }}
                                  title={isPendingConfirm ? "Нажмите еще раз для подтверждения" : "Удалить блок"}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </span>
                              );
                            })()}
                          </span>
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
                      </div>



                      <label className="author-content-field">
                        <span>Контент</span>
                        <textarea
                          rows="14"
                          value={blockDrafts[selectedBlock.id]?.content || ""}
                          onChange={(event) => updateBlockDraft(selectedBlock.id, "content", event.target.value)}
                        />
                      </label>

                      {blockDrafts[selectedBlock.id]?.type === "lecture" && (
                        <div className="attachment-manager">
                          <div className="attachment-manager-header">
                            <span>Методические материалы</span>
                            <small>PDF или DOCX, до 20 МБ</small>
                          </div>
                          <input
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            disabled={attachmentUploadState[selectedBlock.id]?.uploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              handleAttachmentUpload(selectedBlock.id, file);
                            }}
                          />
                          <div className="attachment-list">
                            {getBlockAttachments(blockDrafts[selectedBlock.id]?.attachment_url).map((attachment) => (
                              <div key={attachment.stored_name || attachment.url} className="attachment-item">
                                <a href={getAttachmentHref(attachment.url)} target="_blank" rel="noreferrer">
                                  {attachment.original_name || "Файл"}
                                </a>
                                {attachment.size ? <span>{formatFileSize(attachment.size)}</span> : null}
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleAttachmentDelete(selectedBlock.id, attachment.stored_name)}
                                >
                                  Удалить
                                </button>
                              </div>
                            ))}
                            {!getBlockAttachments(blockDrafts[selectedBlock.id]?.attachment_url).length ? (
                              <p className="helper-text">Файлы пока не прикреплены.</p>
                            ) : null}
                          </div>
                        </div>
                      )}

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
                                  placeholder={opt.is_correct ? "" : "Подсказка"}
                                  value={opt.is_correct ? "" : (opt.hint || "")}
                                  disabled={!!opt.is_correct}
                                  onChange={(e) => {
                                    const newOptions = [...(blockDrafts[selectedBlock.id]?.quiz_data?.options || [])];
                                    newOptions[idx].hint = e.target.value;
                                    updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), options: newOptions });
                                  }}
                                  style={{
                                    padding: "0.5rem",
                                    borderRadius: "4px",
                                    border: "1px solid #cbd5e1",
                                    width: "100%",
                                    background: opt.is_correct ? "#f1f5f9" : "#fff",
                                    cursor: opt.is_correct ? "not-allowed" : "text",
                                    color: opt.is_correct ? "#94a3b8" : "inherit"
                                  }}
                                />
                                <button type="button" className="secondary-button" onClick={() => {
                                  const newOptions = blockDrafts[selectedBlock.id].quiz_data.options.filter((_, i) => i !== idx);
                                  updateBlockDraft(selectedBlock.id, "quiz_data", { ...(blockDrafts[selectedBlock.id]?.quiz_data || {}), options: newOptions });
                                }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", color: "var(--error-color, #ef4444)", borderColor: "#e2e8f0" }} title="Удалить вариант"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
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
                        <CodeTaskEditor
                          blockId={selectedBlock.id}
                          quizData={blockDrafts[selectedBlock.id]?.quiz_data}
                          updateQuizData={(newData) => updateBlockDraft(selectedBlock.id, "quiz_data", newData)}
                          authorTestCode={authorTestCode[selectedBlock.id]}
                          setAuthorTestCode={(val) => setAuthorTestCode(prev => ({ ...prev, [selectedBlock.id]: val }))}
                          handleAuthorTestSubmit={handleAuthorTestSubmit}
                          authorTestResults={authorTestResults[selectedBlock.id]}
                          isTestingCode={isTestingCode[selectedBlock.id]}
                        />
                      )}
                      <div className="action-row" style={{ justifyContent: "flex-end" }}>
                        <button type="submit">Сохранить изменения</button>
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

          <AIChatPanel
            className="author-assistant-panel"
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
            modes={AUTHOR_MODES}
            modeDescriptions={AUTHOR_MODE_DESCRIPTIONS}
            detectedContext={detectedStepRefs}
            chatEndRef={chatEndRef}
          />
        </section>
      ) : null
      }
    </AppLayout >
  );
}
