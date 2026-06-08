import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { setToken } from "../lib/auth";
import { useToast } from "../hooks/useToast";

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student"
  });
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(formData)
      });

      setToken(data.token);
      navigate(data.user.role === "author" ? "/author/dashboard" : "/courses");
    } catch (requestError) {
      toast.error("Не удалось создать аккаунт");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="card">
        <h1>Регистрация</h1>
        <p className="muted">Создайте аккаунт студента или автора.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Имя</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Электронная почта</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Пароль</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength="6"
              required
            />
          </label>

          <label>
            <span>Роль</span>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="student">Студент</option>
              <option value="author">Автор</option>
            </select>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Создание..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="helper-text">
          Уже зарегистрированы? <Link to="/login">Войти</Link>
        </p>
      </section>
    </main>
  );
}
