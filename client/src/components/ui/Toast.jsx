export default function Toast({ toast }) {
  return (
    <div className={`toast toast-${toast.type} ${toast.isClosing ? "toast-closing" : ""}`} role="status">
      <span>{toast.message}</span>
    </div>
  );
}
