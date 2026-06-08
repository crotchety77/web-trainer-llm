import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuthUser } from "../hooks/useAuthUser";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/useToast";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser({ required: true });
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          query: search || "",
          page: pagination.page || 1,
          limit: pagination.limit || 20
        });

        const data = await apiRequest(`/api/admin/users?${queryParams}`, {
          headers: getAuthHeaders()
        });

        if (!cancelled) {
          setUsers(data.users || []);
          setPagination(data.pagination);
        }
      } catch (requestError) {
        if (!cancelled) {
          toast.error("Не удалось загрузить список пользователей");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      loadUsers();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, pagination.page, pagination.limit, toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPagination((current) => ({ ...current, page: 1 }));
  }

  async function handleDeleteUser(id, name) {
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя ${name}?`)) {
      return;
    }

    try {
      await apiRequest(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      toast.success("Пользователь удален");
      setUsers((current) => current.filter((item) => item.id !== id));
      setPagination((current) => ({ ...current, total: current.total - 1 }));
    } catch (error) {
      toast.error(error.message || "Не удалось удалить пользователя");
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <AppLayout
      title="Управление пользователями"
      subtitle="Просмотр и поиск всех зарегистрированных студентов и авторов."
      user={user}
      onLogout={handleLogout}
    >
      <section className="panel">
        <div className="action-row">
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        {loading && users.length === 0 ? (
          <p className="centered-state">Загрузка пользователей...</p>
        ) : (
          <>
            <div className="table-container admin-users-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>
                        <span className={`role-tag role-${item.role}`}>
                          {item.role === "admin" ? "Админ" : item.role === "author" ? "Автор" : "Студент"}
                        </span>
                      </td>
                      <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        {item.id !== user?.id ? (
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteUser(item.id, item.name)}
                            title="Удалить пользователя"
                          >
                            &times;
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading ? (
                    <tr>
                      <td colSpan="6" className="muted empty-table-cell">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="admin-users-cards">
              {users.map((item) => (
                <article key={item.id} className="admin-user-card">
                  <div>
                    <strong>{item.name}</strong>
                    <span className={`role-tag role-${item.role}`}>
                      {item.role === "admin" ? "Админ" : item.role === "author" ? "Автор" : "Студент"}
                    </span>
                  </div>
                  <span>{item.email}</span>
                  <span className="muted">ID: {item.id}</span>
                  <span className="muted">Регистрация: {new Date(item.created_at).toLocaleDateString()}</span>
                  {item.id !== user?.id ? (
                    <button
                      className="secondary-button delete-user-card-button"
                      onClick={() => handleDeleteUser(item.id, item.name)}
                    >
                      Удалить
                    </button>
                  ) : null}
                </article>
              ))}
              {users.length === 0 && !loading ? <p className="muted">Пользователи не найдены</p> : null}
            </div>
          </>
        )}

        <div className="pagination-row">
          <button
            className="secondary-link-button"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
          >
            Назад
          </button>
          <span className="muted">
            Страница {pagination.page} из {totalPages || 1}
          </span>
          <button
            className="secondary-link-button"
            disabled={pagination.page >= totalPages || loading}
            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
          >
            Вперед
          </button>
        </div>
      </section>
    </AppLayout>
  );
}
