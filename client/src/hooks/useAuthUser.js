import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { clearToken, getAuthHeaders, getToken } from "../lib/auth";

export function useAuthUser(options = {}) {
  const { required = false } = options;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(required);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadUser() {
      setLoading(true);
      setError("");

      try {
        const data = await apiRequest("/api/auth/me", {
          headers: getAuthHeaders()
        });

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (requestError) {
        clearToken();
        if (!cancelled) {
          setUser(null);
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [required]);

  return {
    user,
    loading,
    error
  };
}
