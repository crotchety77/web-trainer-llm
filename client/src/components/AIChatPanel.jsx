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
    <aside className={className} aria-label="Chat assistant">
      <div>
        <span className="eyebrow">Ассистент</span>
        <h2>Чат</h2>
      </div>

      <div className="chat-quick-actions">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`chat-mode-button ${activeMode === mode.id ? "active" : ""}`}
            onClick={() => isAssistantAvailable && setActiveMode(activeMode === mode.id ? null : mode.id)}
            disabled={!isAssistantAvailable}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="chat-history">
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
            <div key={index} className={`chat-message ${msg.role}`}>
              {msg.role === "user" && (
                <strong>{user?.name || "You"}</strong>
              )}
              {msg.role === "assistant" ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.text}</p>
              )}
            </div>
          ))
        )}
        {isChatLoading ? <div className="chat-message assistant loading">Печатает...</div> : null}
        {messages.length > 0 ? (
          <div className="chat-clear-row">
            <button
              type="button"
              className="chat-clear-label"
              onClick={onClearHistory}
              title="Очистить историю сообщений"
            >
              Очистить чат
            </button>
          </div>
        ) : null}
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
        <form className="assistant-input-row" onSubmit={(event) => { event.preventDefault(); onSendMessage(); }}>
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
