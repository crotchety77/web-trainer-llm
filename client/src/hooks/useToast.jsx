import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ToastContainer from "../components/ui/ToastContainer";

const ToastContext = createContext(null);
const TOAST_DURATION = 3000;
const TOAST_EXIT_DURATION = 220;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast))
    );

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_DURATION);
  }, []);

  const show = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nextToast = { id, type, message: String(message || "") };

    setToasts((current) => [...current, nextToast]);
    window.setTimeout(() => removeToast(id), TOAST_DURATION);

    return id;
  }, [removeToast]);

  const toast = useMemo(() => ({
    success: (message) => show("success", message),
    error: (message) => show("error", message),
    info: (message) => show("info", message),
    warning: (message) => show("warning", message)
  }), [show]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return toast;
}
