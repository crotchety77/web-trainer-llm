import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { getApiUrl, apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

function isValidUserLlmApiKey(value) {
  const trimmed = value.trim();
  return trimmed.length >= 20 && trimmed.length <= 300 && !/\s/.test(trimmed);
}

function isValidUserLlmFolderId(value) {
  const trimmed = value.trim();
  return trimmed.length >= 6 && trimmed.length <= 128 && /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, error } = useAuthUser({ required: true });
  const toast = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [hasUserApiKey, setHasUserApiKey] = useState(false);
  const [hasUserFolderId, setHasUserFolderId] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [folderIdInput, setFolderIdInput] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [folderIdSaving, setFolderIdSaving] = useState(false);

  useEffect(() => {
    setHasUserApiKey(Boolean(user?.has_llm_api_key));
    setHasUserFolderId(Boolean(user?.has_llm_folder_id));
  }, [user?.has_llm_api_key, user?.has_llm_folder_id]);

  useEffect(() => {
    if (user?.role === "student") {
      setLoadingEnrollments(true);
      apiRequest("/api/student/courses", { headers: getAuthHeaders() })
        .then(data => setEnrollments(data.enrollments || []))
        .catch(() => toast.error("Не удалось загрузить прогресс обучения"))
        .finally(() => setLoadingEnrollments(false));
    }
  }, [user, toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function handleApiKeySubmit(event) {
    event.preventDefault();

    const trimmedApiKey = apiKeyInput.trim();

    if (!isValidUserLlmApiKey(trimmedApiKey)) {
      toast.error("API key must be 20-300 characters and must not contain spaces.");
      return;
    }

    setApiKeySaving(true);

    try {
      const data = await apiRequest("/api/auth/me/api-key", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ apiKey: trimmedApiKey })
      });

      setHasUserApiKey(Boolean(data.has_llm_api_key));
      setApiKeyInput("");
      toast.success("API key saved.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleApiKeyDelete() {
    setApiKeySaving(true);

    try {
      const data = await apiRequest("/api/auth/me/api-key", {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      setHasUserApiKey(Boolean(data.has_llm_api_key));
      setApiKeyInput("");
      toast.success("API key removed.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleFolderIdSubmit(event) {
    event.preventDefault();

    const trimmedFolderId = folderIdInput.trim();

    if (!isValidUserLlmFolderId(trimmedFolderId)) {
      toast.error("Folder ID must be 6-128 characters and contain only letters, numbers, underscores, or hyphens.");
      return;
    }

    setFolderIdSaving(true);

    try {
      const data = await apiRequest("/api/auth/me/folder-id", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ folderId: trimmedFolderId })
      });

      setHasUserFolderId(Boolean(data.has_llm_folder_id));
      setFolderIdInput("");
      toast.success("Folder ID saved.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setFolderIdSaving(false);
    }
  }

  async function handleFolderIdDelete() {
    setFolderIdSaving(true);

    try {
      const data = await apiRequest("/api/auth/me/folder-id", {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      setHasUserFolderId(Boolean(data.has_llm_folder_id));
      setFolderIdInput("");
      toast.success("Folder ID removed.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setFolderIdSaving(false);
    }
  }

  if (loading) {
    return <main className="centered-state">Loading profile...</main>;
  }

  return (
    <AppLayout
      title="Dashboard"
      subtitle="JWT auth is active. Use this page as the role-based entry point."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel dashboard-panel">
        {error ? (
          <p className="helper-text">
            Сессия истекла. <Link to="/login">Войдите снова</Link>.
          </p>
        ) : null}

        {user ? (
          <div className="profile-grid">
            <div>
              <span className="profile-label">Name</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span className="profile-label">Email</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span className="profile-label">Role</span>
              <strong>{user.role}</strong>
            </div>
            <div>
              <span className="profile-label">API</span>
              <strong>{getApiUrl()}</strong>
            </div>
          </div>
        ) : null}

        {user ? (
          <section className="profile-api-key-settings" aria-label="LLM API key settings">
            <div>
              <h2>LLM API key</h2>
              <p className="helper-text">
                {hasUserApiKey
                  ? hasUserFolderId
                    ? "Personal Yandex credentials are configured for assistant requests."
                    : "Add your Yandex Folder ID to enable assistant chat."
                  : "Assistant chat is unavailable until you add a personal API key and Folder ID."}
              </p>
            </div>

            <form className="profile-api-key-form" onSubmit={handleApiKeySubmit}>
              <label className="profile-api-key-field">
                <span className="profile-label">Personal Yandex API key</span>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder={hasUserApiKey ? "Enter a new key to replace the saved one" : "Enter your API key"}
                  autoComplete="off"
                />
              </label>
              <div className="profile-api-key-actions">
                <button type="submit" disabled={apiKeySaving || !apiKeyInput.trim()}>
                  {apiKeySaving ? "Saving..." : hasUserApiKey ? "Replace key" : "Save key"}
                </button>
                {hasUserApiKey ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleApiKeyDelete}
                    disabled={apiKeySaving}
                  >
                    Delete key
                  </button>
                ) : null}
              </div>
            </form>

            <form className="profile-api-key-form" onSubmit={handleFolderIdSubmit}>
              <label className="profile-api-key-field">
                <span className="profile-label">Personal Yandex Folder ID</span>
                <input
                  type="text"
                  value={folderIdInput}
                  onChange={(event) => setFolderIdInput(event.target.value)}
                  placeholder="Enter your Folder ID"
                  autoComplete="off"
                />
              </label>
              <div className="profile-api-key-actions">
                <button type="submit" disabled={folderIdSaving || !folderIdInput.trim()}>
                  {folderIdSaving ? "Saving..." : hasUserFolderId ? "Replace Folder ID" : "Save Folder ID"}
                </button>
                {hasUserFolderId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleFolderIdDelete}
                    disabled={folderIdSaving}
                  >
                    Delete Folder ID
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        {user?.role === "author" ? (
          <div className="action-row">
            <Link className="primary-link-button" to="/author/dashboard">
              Go to Author Dashboard
            </Link>
            <Link className="secondary-link-button" to="/courses">
              View Published Courses
            </Link>
          </div>
        ) : (
          <>
            <div className="action-row">
              <Link className="primary-link-button" to="/courses">
                Browse Courses
              </Link>
            </div>
            
            <div style={{ marginTop: "2.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>Мой прогресс обучения</h3>
              {loadingEnrollments ? (
                <p className="helper-text">Загрузка ваших курсов...</p>
              ) : enrollments.length > 0 ? (
                <div className="course-list">
                  {enrollments.map(course => {
                    const percentage = course.total_blocks > 0 ? Math.round((course.completed_blocks / course.total_blocks) * 100) : 0;
                    return (
                      <article key={course.id} className="course-card compact" style={{ display: 'block', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0 }}>{course.title}</h4>
                          <span style={{ fontWeight: 'bold', color: '#0b63f6' }}>{percentage}%</span>
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', width: '100%', overflow: 'hidden', marginBottom: '1.5rem' }}>
                          <div style={{ background: '#0b63f6', height: '100%', width: `${percentage}%`, transition: 'width 0.3s ease' }}></div>
                        </div>
                        <div className="meta-row" style={{ justifyContent: 'space-between' }}>
                          <span className="helper-text" style={{ fontSize: '0.85rem' }}>
                            Выполнено: {course.completed_blocks} из {course.total_blocks}
                          </span>
                          <Link className="secondary-button" style={{ padding: '8px 14px', fontSize: '0.85rem' }} to={`/courses/${course.id}`}>
                            Продолжить
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="helper-text">Вы еще не записались ни на один курс.</p>
              )}
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
