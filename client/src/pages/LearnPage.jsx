import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";

export default function LearnPage() {
  const navigate = useNavigate();
  const { courseId, lessonId } = useParams();
  const { user } = useAuthUser();
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [solutions, setSolutions] = useState({});
  const [submissionState, setSubmissionState] = useState({});

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
          setError(requestError.message);
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
                                disabled={blockState.submitting}
                                onClick={() => handleSubmitSolution(block.id)}
                              >
                                {blockState.submitting ? "Submitting..." : "Submit solution"}
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

              <aside className="assistant-panel" aria-label="Chat assistant">
                <div>
                  <span className="eyebrow">Assistant</span>
                  <h2>Chat</h2>
                </div>
                <div className="assistant-placeholder">
                  <p>Ask for a hint, explain an error, or review your approach.</p>
                </div>
                <div className="assistant-input-row">
                  <input type="text" placeholder="Chat assistant coming soon" disabled />
                  <button type="button" className="secondary-button" disabled>
                    Send
                  </button>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
