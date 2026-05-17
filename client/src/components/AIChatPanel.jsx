import ReactMarkdown from "react-markdown";
import AssistantTextarea from "./AssistantTextarea";
import AssistantUnavailableNotice from "./AssistantUnavailableNotice";

export default function AIChatPanel({
  user,
  messages,
  chatInput,
  setChatInput,
  onSendMessage,
  onClearHistory,
  isChatLoading,
  isAssistantAvailable,
  activeMode,
  setActiveMode,
  modes = [],
  modeDescriptions = {},
  detectedContext = [],
  chatEndRef,
  className = "assistant-panel"
}) {
  return (
    <aside className={className} aria-label="Chat assistant" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div>
        <span className="eyebrow">Ассистент</span>
        <h2>Чат</h2>
      </div>

      <div className="chat-quick-actions">
        {modes.map(mode => (
          <button
            key={mode.id}
            type="button"
            onClick={() => isAssistantAvailable && setActiveMode(activeMode === mode.id ? null : mode.id)}
            disabled={!isAssistantAvailable}
            style={{
              fontSize: "0.75rem",
              minHeight: "38px",
              padding: "0.45rem 0.55rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: activeMode === mode.id ? "var(--primary-color, #0b63f6)" : "transparent",
              color: activeMode === mode.id ? "#fff" : (isAssistantAvailable ? "inherit" : "var(--text-muted, #94a3b8)"),
              cursor: isAssistantAvailable ? "pointer" : "not-allowed",
              whiteSpace: "normal",
              lineHeight: 1.2
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="chat-history" style={{
        flex: "1 1 auto",
        overflowY: "auto",
        paddingTop: "1rem",
        display: "flex",
        flexDirection: "column",
        minHeight: 0 // Важно для корректного скролла внутри flex-контейнера
      }}>
        {messages.length === 0 ? (
          <div className="assistant-placeholder">
            {isAssistantAvailable ? (
              <p>{modeDescriptions[activeMode || "default"]}</p>
            ) : (
              <AssistantUnavailableNotice />
            )}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? "var(--surface-color, #f1f5f9)" : "var(--primary-light, #e0f2fe)", padding: "0.75rem", borderRadius: "8px", maxWidth: "90%", marginRight: msg.role === "user" ? "0.5rem" : "0" }}>
              {msg.role === "user" && (
                <strong style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>{user?.name || "You"}</strong>
              )}
              {msg.role === "assistant" ? (
                <div className="markdown-content" style={{ paddingTop: "0.25rem", fontSize: "0.95rem" }}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ margin: "0.25rem 0 0 0", whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>{msg.text}</p>
              )}
            </div>
          ))
        )}
        {isChatLoading && <div className="chat-message assistant" style={{ alignSelf: "flex-start", padding: "0.75rem", color: "var(--text-muted, #64748b)" }}>Печатает...</div>}
        {messages.length > 0 && (
          <div style={{ textAlign: "right", paddingRight: "0.5rem", marginTop: "-0.75rem" }}>
            <span
              className="chat-clear-label"
              onClick={onClearHistory}
              title="Очистить историю сообщений"
              style={{ cursor: "pointer", fontSize: "0.75rem", color: "var(--text-muted, #64748b)", textDecoration: "underline" }}
            >
              Очистить чат
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div>
        {detectedContext.length > 0 ? (
          <div className="assistant-context-hints" aria-label="Selected step context">
            {detectedContext.map((stepNumber) => (
              <span key={stepNumber} className="tag-chip">
                @step{stepNumber}
              </span>
            ))}
          </div>
        ) : null}
        <form className="assistant-input-row" onSubmit={(e) => { e.preventDefault(); onSendMessage(); }}>
          <AssistantTextarea
            value={chatInput}
            onChange={setChatInput}
            onSubmit={onSendMessage}
            placeholder={isAssistantAvailable ? (activeMode ? "Введите ваш запрос..." : "Напишите сообщение или выберите режим...") : "Чат недоступен. Добавьте API ключ и Folder ID."}
            disabled={isChatLoading || !isAssistantAvailable}
          />
          <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim() || !isAssistantAvailable}>
            Отправить
          </button>
        </form>
      </div>
    </aside>
  );
}
