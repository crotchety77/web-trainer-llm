import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import ReactMarkdown from "react-markdown";
import { clearToken, getAuthHeaders } from "../lib/auth";

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

const AUTHOR_MODES = [
  { id: 'improve_text', label: '📝 Улучшить', icon: '📝' },
  { id: 'generate_task', label: '🎯 Задание', icon: '🎯' },
  { id: 'structure', label: '📑 Структура', icon: '📑' },
];

function createBlockDrafts(blocks) {
  return Object.fromEntries(
    blocks.map((block) => [
      block.id,
      {
        type: block.type,
        title: block.title,
        content: block.content,
        attachment_url: block.attachment_url,
        position: block.position
      }
    ])
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
  const [courseTitle, setCourseTitle] = useState("Course content");
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(null);

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) || null;
  }, [lessons, selectedLessonId]);

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

  const selectedBlock = useMemo(() => {
    return (lessonDetail?.blocks || []).find((block) => block.id === activeBlockId) || null;
  }, [lessonDetail, activeBlockId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourseContent() {
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
          setCourseTitle(courseResponse.course?.title || "Course content");
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

    loadCourseContent();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

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
          setError(requestError.message);
        }
      }
    }

    loadLesson();

    return () => {
      cancelled = true;
    };
  }, [selectedLessonId]);

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
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(`/api/courses/${params.id}/lessons`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(createLessonForm)
      });

      const createdLesson = response.lesson;
      setLessons((current) => [...current, createdLesson].sort((a, b) => a.position - b.position));
      setSelectedLessonId(createdLesson.id);
      setCreateLessonForm(emptyLesson);
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
      setBlockDrafts(createBlockDrafts(lessonResponse.lesson.blocks || []));
      setActiveBlockId(blockId);
      setMessage("Block updated.");
    } catch (requestError) {
      setError(requestError.message);
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
    setError("");
    setMessage("Saving lesson order...");

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
      setMessage("Lesson order saved.");
    } catch (requestError) {
      setLessons(previousLessons);
      setError(requestError.message);
      setMessage("");
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
    setError("");
    setMessage("Saving block order...");

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
              position: block.position
            })
          });
        })
      );
      setMessage("Block order saved.");
    } catch (requestError) {
      setLessonDetail(previousLessonDetail);
      setBlockDrafts(createBlockDrafts(previousLessonDetail.blocks || []));
      setError(requestError.message);
      setMessage("");
      try {
        await reloadSelectedLesson(activeBlockId);
      } catch {
        // Keep the original error visible; the next manual action can retry loading.
      }
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
      const editorContext = lessonDetail
        ? `Автор редактирует урок: "${lessonDetail.title}".\nТекущие блоки урока:\n` + (lessonDetail.blocks || []).map(b => `[${b.type}] ${b.title}: ${b.content}`).join('\n')
        : "Автор пока не выбрал урок.";

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
      setActiveMode(null);
    } catch (requestError) {
      setChatMessages((current) => [...current, { role: "assistant", text: `Ошибка: ${requestError.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <AppLayout
      title={courseTitle}
      subtitle="Build lessons, choose block types, and edit course content."
      user={user}
      onLogout={handleLogout}
    >
      <div className="author-content-actions">
        <Link className="secondary-link-button" to={`/author/courses/${params.id}/edit`}>
          Edit course page
        </Link>
        <Link className="secondary-link-button" to="/author/dashboard">
          Back to dashboard
        </Link>
      </div>

      {loading ? <p>Loading course content...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {!loading ? (
        <section className="author-editor-layout">
          <aside className="author-lessons-sidebar" aria-label="Course lessons">
            <div className="author-panel-header">
              <span className="eyebrow">Course map</span>
              <h2>Lessons</h2>
            </div>

            <div className="lesson-accordion">
              {lessonSections.map((section) => {
                const isCurrentSection = section.lessons.some((lesson) => lesson.id === selectedLessonId);

                return (
                  <details key={section.title} className="lesson-section" open={isCurrentSection}>
                    <summary>
                      <span>{section.title}</span>
                      <span className="lesson-count">{section.lessons.length}</span>
                    </summary>
                    <div className="lesson-section-list">
                      {section.lessons.map((lesson) => (
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
                          <span className="lesson-number">{lesson.position}</span>
                          <strong>
                            {lesson.position}. {lesson.title}
                          </strong>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>

            <form className="author-create-lesson form compact-form" onSubmit={handleLessonCreate}>
              <h3>Add lesson</h3>
              <label>
                <span>Title</span>
                <input
                  value={createLessonForm.title}
                  onChange={(event) =>
                    setCreateLessonForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Position</span>
                <input
                  type="number"
                  min="1"
                  value={createLessonForm.position}
                  onChange={(event) =>
                    setCreateLessonForm((current) => ({
                      ...current,
                      position: Number(event.target.value) || 1
                    }))
                  }
                />
              </label>
              <button type="submit">Add lesson</button>
            </form>
          </aside>

          <main className="author-workspace">
            {selectedLesson && lessonDetail ? (
              <>
                <form className="author-lesson-bar" onSubmit={handleLessonUpdate}>
                  <div className="author-panel-header">
                    <span className="eyebrow">Selected lesson</span>
                    <h2>{selectedLesson.title}</h2>
                  </div>
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
                    <span>New block title</span>
                    <input
                      value={newBlockForm.title}
                      onChange={(event) =>
                        setNewBlockForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Short task name"
                      required
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
                  <button type="submit">Add block</button>
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
                      <p className="helper-text">No blocks yet. Add a lecture, practice, or test block above.</p>
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
                          <span className="eyebrow">Editing block #{selectedBlock.id}</span>
                          <h3>{blockDrafts[selectedBlock.id]?.title || selectedBlock.title}</h3>
                        </div>
                        <button type="submit">Save changes</button>
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
                          <span>Title</span>
                          <input
                            value={blockDrafts[selectedBlock.id]?.title || ""}
                            onChange={(event) => updateBlockDraft(selectedBlock.id, "title", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Position</span>
                          <input
                            type="number"
                            min="1"
                            value={blockDrafts[selectedBlock.id]?.position || 1}
                            onChange={(event) =>
                              updateBlockDraft(selectedBlock.id, "position", Number(event.target.value) || 1)
                            }
                          />
                        </label>
                        <label>
                          <span>Attachment URL</span>
                          <input
                            value={blockDrafts[selectedBlock.id]?.attachment_url || ""}
                            onChange={(event) =>
                              updateBlockDraft(selectedBlock.id, "attachment_url", event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <label className="author-content-field">
                        <span>Content</span>
                        <textarea
                          rows="14"
                          value={blockDrafts[selectedBlock.id]?.content || ""}
                          onChange={(event) => updateBlockDraft(selectedBlock.id, "content", event.target.value)}
                        />
                      </label>
                    </form>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="author-empty-state">
                <p>Create a lesson to start building course content.</p>
              </div>
            )}
          </main>

          <aside className="author-assistant-panel" aria-label="Course assistant" style={{ display: "flex", flexDirection: "column" }}>
            <div className="author-panel-header">
              <span className="eyebrow">Assistant</span>
              <h2>Course chat</h2>
            </div>
            
            <div className="chat-quick-actions" style={{ display: "flex", gap: "0.5rem", padding: "0 0.5rem", overflowX: "auto", flexShrink: 0 }}>
              {AUTHOR_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveMode(activeMode === mode.id ? null : mode.id)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: activeMode === mode.id ? "var(--primary-color, #0284c7)" : "transparent",
                    color: activeMode === mode.id ? "#fff" : "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="chat-history" style={{ flex: 1, overflowY: "auto", padding: "1rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chatMessages.length === 0 ? (
                <div className="author-assistant-placeholder">
                  <p>Draft explanations, suggest practice tasks, outline lesson structure, or improve hints.</p>
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
                placeholder="Ask assistant..." 
                disabled={isChatLoading} 
              />
              <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim()}>
                Send
              </button>
            </form>
          </aside>
        </section>
      ) : null}
    </AppLayout>
  );
}
