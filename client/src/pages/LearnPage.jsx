import { useEffect, useState } from "react";
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
      subtitle="Lesson navigation on the left, ordered content blocks on the right."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        {loading ? <p>Loading lesson...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && lesson ? (
          <div className="learn-layout">
            <aside className="sidebar-panel">
              <h3>Lessons</h3>
              <div className="stack-list">
                {lessons.map((item) => (
                  <Link
                    key={item.id}
                    className={`lesson-link-card ${item.id === lesson.id ? "active" : ""}`}
                    to={`/learn/${courseId}/${item.id}`}
                  >
                    <strong>
                      {item.position}. {item.title}
                    </strong>
                  </Link>
                ))}
              </div>
            </aside>

            <div className="lesson-content">
              <div className="lesson-header">
                <h2>
                  {lesson.position}. {lesson.title}
                </h2>
                <p className="muted">
                  Blocks are grouped lecture → practice → test, then sorted by position.
                </p>
              </div>

              <div className="stack-list">
                {lesson.blocks.map((block) => (
                  <article key={block.id} className="block-card">
                    <div className="block-meta">
                      <span className="tag-chip">{block.type}</span>
                      <span>Position: {block.position}</span>
                    </div>
                    <h3>{block.title}</h3>
                    <p>{block.content}</p>
                    {block.attachment_url ? (
                      <a href={block.attachment_url} target="_blank" rel="noreferrer">
                        Attachment
                      </a>
                    ) : null}
                    {["practice", "test"].includes(block.type) ? (
                      <div className="code-submission">
                        <label htmlFor={`solution-${block.id}`}>Solution code</label>
                        <textarea
                          id={`solution-${block.id}`}
                          aria-label={`Solution code for ${block.title}`}
                          className="code-editor"
                          rows={10}
                          value={solutions[block.id] || ""}
                          onChange={(event) => handleSolutionChange(block.id, event.target.value)}
                          placeholder="function solve() {&#10;  return true;&#10;}"
                        />
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={submissionState[block.id]?.submitting}
                            onClick={() => handleSubmitSolution(block.id)}
                          >
                            {submissionState[block.id]?.submitting ? "Submitting..." : "Submit solution"}
                          </button>
                          {submissionState[block.id]?.error ? (
                            <p className="error">{submissionState[block.id].error}</p>
                          ) : null}
                          {submissionState[block.id]?.submission ? (
                            <p className="success">
                              {submissionState[block.id].submission.result_message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
