import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { setToken } from "../lib/auth";
import { useToast } from "../hooks/useToast";

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
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
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formData)
      });

      setToken(data.token);
      if (data.user.role === "admin") {
        navigate("/admin/users");
      } else if (data.user.role === "author") {
        navigate("/author/dashboard");
      } else {
        navigate("/courses");
      }
    } catch (requestError) {
      toast.error("Не удалось войти. Проверьте email и пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="card">
        <h1>Вход</h1>
        <p className="muted">Войдите, чтобы продолжить работу.</p>

        <form className="form" onSubmit={handleSubmit}>
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
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="helper-text">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}
