import { useEffect, useState } from "react";
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
  const isMobile = className.includes("assistant-panel-mobile");
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeDetectedContext = Array.isArray(detectedContext) ? detectedContext : [];
  const safeModes = Array.isArray(modes) ? modes : [];
  const activeModeLabel = safeModes.find((mode) => mode.id === activeMode)?.label || "Выбрать режим";

  function handleModeClick(mode, event) {
    if (!isAssistantAvailable) {
      return;
    }

    setActiveMode?.(activeMode === mode.id ? null : mode.id);
    if (isMobile) {
      setIsOpen(false);
    }
  }

  return (
    <aside className={className} aria-label="Chat assistant">
      <div className="chat-panel-title">
        <span className="eyebrow">Ассистент</span>
        <h2>Чат</h2>
      </div>

      {safeModes.length > 0 ? (
        <details
          className="chat-mode-disclosure"
          open={isOpen}
          onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>{activeModeLabel}</span>
            <span className="chat-mode-chevron" aria-hidden="true" />
          </summary>
          <div className="chat-quick-actions">
            {safeModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`chat-mode-button ${activeMode === mode.id ? "active" : ""}`}
                onClick={(event) => handleModeClick(mode, event)}
                disabled={!isAssistantAvailable}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      <div className="chat-history">
        {safeMessages.length === 0 ? (
          <div className="assistant-placeholder">
            {isAssistantAvailable ? (
              <p>{modeDescriptions[activeMode || "default"]}</p>
            ) : (
              <AssistantUnavailableNotice />
            )}
          </div>
        ) : (
          safeMessages.map((msg, index) => {
            const role = msg?.role === "user" ? "user" : "assistant";
            const text = typeof msg?.text === "string" ? msg.text : String(msg?.text ?? msg?.message ?? "");

            return (
              <div key={index} className={`chat-message ${role}`}>
                {role === "user" ? <strong>{user?.name || "You"}</strong> : null}
                {role === "assistant" ? (
                  <div className="markdown-content">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{text}</p>
                )}
              </div>
            );
          })
        )}
        {isChatLoading ? <div className="chat-message assistant loading">Печатает...</div> : null}
        {safeMessages.length > 0 ? (
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
        {safeDetectedContext.length > 0 ? (
          <div className="assistant-context-hints" aria-label="Selected step context">
            {safeDetectedContext.map((stepNumber) => (
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
