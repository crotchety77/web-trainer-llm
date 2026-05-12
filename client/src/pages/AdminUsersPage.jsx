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
    }, 300); // Debounce search

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, pagination.page, pagination.limit, toast]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPagination(p => ({ ...p, page: 1 })); // Reset to first page on search
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

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
      // Reload users or filter out
      setUsers(current => current.filter(u => u.id !== id));
      setPagination(p => ({ ...p, total: p.total - 1 }));
    } catch (error) {
      toast.error(error.message || "Не удалось удалить пользователя");
    }
  }

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
            style={{ width: '100%', maxWidth: '400px', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
          />
        </div>

        {loading && users.length === 0 ? (
          <p className="centered-state">Загрузка пользователей...</p>
        ) : (
          <div className="table-container" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.8rem' }}>ID</th>
                  <th style={{ padding: '0.8rem' }}>Имя</th>
                  <th style={{ padding: '0.8rem' }}>Email</th>
                  <th style={{ padding: '0.8rem' }}>Роль</th>
                  <th style={{ padding: '0.8rem' }}>Дата регистрации</th>
                  <th style={{ padding: '0.8rem', textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.8rem' }}>{u.id}</td>
                    <td style={{ padding: '0.8rem' }}>{u.name}</td>
                    <td style={{ padding: '0.8rem' }}>{u.email}</td>
                    <td style={{ padding: '0.8rem' }}>
                      <span className={`tag role-${u.role}`} style={{ 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.85rem',
                        backgroundColor: u.role === 'admin' ? '#fee2e2' : u.role === 'author' ? '#fef3c7' : '#dcfce7',
                        color: u.role === 'admin' ? '#991b1b' : u.role === 'author' ? '#92400e' : '#166534'
                      }}>
                        {u.role === 'admin' ? 'Админ' : u.role === 'author' ? 'Автор' : 'Студент'}
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                      {u.id !== user?.id && (
                        <button 
                          className="delete-button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          title="Удалить пользователя"
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#ef4444', 
                            fontSize: '1.2rem', 
                            cursor: 'pointer',
                            padding: '4px 8px'
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center' }} className="muted">
                      Пользователи не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-row" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
          <button
            className="secondary-link-button"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
          >
            Назад
          </button>
          <span className="muted">
            Страница {pagination.page} из {totalPages || 1}
          </span>
          <button
            className="secondary-link-button"
            disabled={pagination.page >= totalPages || loading}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
          >
            Вперед
          </button>
        </div>
      </section>
    </AppLayout>
  );
}
