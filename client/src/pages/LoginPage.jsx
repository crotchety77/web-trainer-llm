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
      navigate(data.user.role === "author" ? "/author/dashboard" : "/courses");
    } catch (requestError) {
      toast.error("Не удалось войти. Проверьте email и пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="card">
        <h1>Login</h1>
        <p className="muted">Sign in to continue to your dashboard.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="helper-text">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}
