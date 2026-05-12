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
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false);
  const [isFolderIdEditing, setIsFolderIdEditing] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [folderIdSaving, setFolderIdSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);

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
      toast.error("API ключ должен быть длиной от 20 до 300 символов и не должен содержать пробелы.");
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
      setIsApiKeyEditing(false);
      toast.success("API ключ сохранен.");
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
      setIsApiKeyEditing(false);
      toast.success("API ключ удален.");
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
      toast.error("Folder ID должен быть длиной от 6 до 128 символов и содержать только буквы, цифры, нижние подчеркивания или дефисы.");
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
      setIsFolderIdEditing(false);
      toast.success("Folder ID сохранен.");
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
      setIsFolderIdEditing(false);
      toast.success("Folder ID удален.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setFolderIdSaving(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!currentPassword) {
      toast.error("Введите текущий пароль.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Новый пароль должен быть не менее 6 символов.");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("Новый пароль должен отличаться от старого.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают.");
      return;
    }

    setPasswordSaving(true);

    try {
      await apiRequest("/api/auth/me/password", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль успешно изменен.");
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return <main className="centered-state">Загрузка профиля...</main>;
  }

  return (
    <AppLayout
      title="Личный кабинет"
      subtitle="Управление профилем и настройками ИИ-ассистента."
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
              <span className="profile-label">Имя</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span className="profile-label">Электронная почта</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span className="profile-label">Роль</span>
              <strong>
                {user.role === "admin"
                  ? "Администратор"
                  : user.role === "author"
                    ? "Автор"
                    : "Студент"}
              </strong>
            </div>
            <div>
              <span className="profile-label">API URL</span>
              <strong>{getApiUrl()}</strong>
            </div>
          </div>
        ) : null}

        <section className="profile-password-settings">
          <header
            onClick={() => setIsPasswordSectionOpen(!isPasswordSectionOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div>
              <h2>Смена пароля</h2>
              <p className="helper-text" style={{ margin: '4px 0 0 0' }}>Открытие секции смены пароля</p>
            </div>
            <span style={{
              fontSize: '1.5rem',
              transition: 'transform 0.3s ease',
              transform: isPasswordSectionOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--primary-color)'
            }}>
              ›
            </span>
          </header>

          {isPasswordSectionOpen && (
            <form className="profile-api-key-form" onSubmit={handlePasswordSubmit} style={{ marginTop: "1.5rem" }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <label className="profile-api-key-field" style={{ maxWidth: '400px' }}>
                  <span className="profile-label">Текущий пароль</span>
                  <input
                    type="text"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    required
                  />
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <label className="profile-api-key-field" style={{ flex: '1 1 300px' }}>
                    <span className="profile-label">Новый пароль</span>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      required
                    />
                  </label>
                  <label className="profile-api-key-field" style={{ flex: '1 1 300px' }}>
                    <span className="profile-label">Подтвердите новый пароль</span>
                    <input
                      type="text"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите новый пароль"
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="profile-api-key-actions" style={{ marginTop: '1.5rem' }}>
                <button type="submit" disabled={passwordSaving || !newPassword || !currentPassword}>
                  {passwordSaving ? "Сохранение..." : "Обновить пароль"}
                </button>
              </div>
            </form>
          )}
        </section>

        {user && user.role !== "admin" ? (
          <section className="profile-api-key-settings" aria-label="LLM API key settings">
            <div>
              <h2>API ключ LLM</h2>
              <p className="helper-text">
                {hasUserApiKey
                  ? hasUserFolderId
                    ? "Персональные данные Yandex настроены для работы ассистента."
                    : "Добавьте персональный Folder ID, чтобы включить чат с ассистентом."
                  : "Чат ассистента недоступен, пока вы не добавите персональный API ключ и Folder ID."}
              </p>
            </div>

            <form className="profile-api-key-form" onSubmit={handleApiKeySubmit}>
              <label className="profile-api-key-field">
                <span className="profile-label">Персональный API ключ Yandex</span>
                <input
                  type="password"
                  value={hasUserApiKey && !isApiKeyEditing ? "••••••••••••••••••••••••••••••••••••••••" : apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  onFocus={() => setIsApiKeyEditing(true)}
                  onBlur={() => {
                    if (!apiKeyInput.trim()) {
                      setIsApiKeyEditing(false);
                    }
                  }}
                  placeholder="Введите ваш API ключ"
                  autoComplete="off"
                  readOnly={hasUserApiKey && !isApiKeyEditing}
                />
              </label>
              <div className="profile-api-key-actions">
                <button type="submit" disabled={apiKeySaving || !apiKeyInput.trim()}>
                  {apiKeySaving ? "Сохранение..." : hasUserApiKey ? "Заменить ключ" : "Сохранить ключ"}
                </button>
                {hasUserApiKey ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleApiKeyDelete}
                    disabled={apiKeySaving}
                  >
                    Удалить ключ
                  </button>
                ) : null}
              </div>
            </form>

            <form className="profile-api-key-form" onSubmit={handleFolderIdSubmit}>
              <label className="profile-api-key-field">
                <span className="profile-label">Персональный Yandex Folder ID</span>
                <input
                  type="text"
                  value={hasUserFolderId && !isFolderIdEditing ? "•••••••••••••••••••••••" : folderIdInput}
                  onChange={(event) => setFolderIdInput(event.target.value)}
                  onFocus={() => setIsFolderIdEditing(true)}
                  onBlur={() => {
                    if (!folderIdInput.trim()) {
                      setIsFolderIdEditing(false);
                    }
                  }}
                  placeholder="Введите ваш Folder ID"
                  autoComplete="off"
                  readOnly={hasUserFolderId && !isFolderIdEditing}
                />
              </label>
              <div className="profile-api-key-actions">
                <button type="submit" disabled={folderIdSaving || !folderIdInput.trim()}>
                  {folderIdSaving ? "Сохранение..." : hasUserFolderId ? "Заменить Folder ID" : "Сохранить Folder ID"}
                </button>
                {hasUserFolderId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleFolderIdDelete}
                    disabled={folderIdSaving}
                  >
                    Удалить Folder ID
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        {user?.role === "admin" ? (
          <div className="action-row">
            <Link className="primary-link-button" to="/admin/users">
              Перейти в панель админа
            </Link>
            <Link className="secondary-link-button" to="/courses">
              Просмотр каталога курсов
            </Link>
          </div>
        ) : user?.role === "author" ? (
          <div className="action-row">
            <Link className="primary-link-button" to="/author/dashboard">
              Перейти в панель автора
            </Link>
            <Link className="secondary-link-button" to="/courses">
              Просмотр опубликованных курсов
            </Link>
          </div>
        ) : (
          <>
            <div className="action-row">
              <Link className="primary-link-button" to="/courses">
                Каталог курсов
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
