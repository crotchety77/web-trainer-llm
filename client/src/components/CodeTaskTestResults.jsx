import React from "react";

export default function CodeTaskTestResults({ results, isAuthor = false }) {
  if (!results) return null;

  const isSuccess = results.status === "passed" || results.status === "accepted";

  // Сортируем тест-кейсы: сначала упавшие (passed === false), затем успешные (passed === true)
  // При этом сохраняем исходный порядковый номер теста (originalIdx)
  const sortedDetails = (results.tests_result?.details || [])
    .map((detail, idx) => ({ ...detail, originalIdx: idx }))
    .sort((a, b) => {
      if (a.passed === b.passed) return 0;
      return a.passed ? 1 : -1;
    });

  // Локализация статуса выполнения
  let statusText = results.status || "Результат";
  if (results.status === "passed" || results.status === "accepted") {
    statusText = "Успешно";
  } else if (results.status === "failed") {
    statusText = "Ошибка";
  } else if (results.status === "error") {
    statusText = "Ошибка";
  }

  // Локализация сообщения об ошибках / результатах проверки
  let messageText = results.result_message || "";
  if (messageText === "All tests passed successfully!") {
    messageText = "Все проверки успешно пройдены!";
  } else if (messageText === "Code passed. No tests configured.") {
    messageText = "Код успешно выполнен. Тесты не настроены.";
  } else if (messageText.includes("out of") && messageText.includes("failed")) {
    const match = messageText.match(/(\d+)\s+out\s+of\s+(\d+)\s+tests\s+failed\./);
    if (match) {
      messageText = `Не пройдено проверок: ${match[1]} из ${match[2]}.`;
    }
  }

  return (
    <div className="code-task-results-wrapper" style={{ marginTop: "1rem" }}>
      {/* Компактный блок статуса выполнения */}
      <div className={`check-result ${isSuccess ? "success-result" : "error-result"}`}>
        <span className="result-status-title">{statusText}</span>
        <p className={`result-message-text ${isSuccess ? "result-text-success" : "result-text-error"}`}>
          {messageText}
        </p>
      </div>

      {results.tests_result ? (
        <div className="test-stats" style={{ marginTop: "1.25rem" }}>
          {/* Сводная статистика вынесена за пределы цветного контейнера статуса */}
          <div className="test-stats-summary" style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontWeight: "bold", alignItems: "start" }}>
            <span className="test-stat-item total" style={{ alignSelf: "center", height: "fit-content", width: "fit-content" }}>Всего: {results.tests_result.total}</span>
            <span className="test-stat-item passed" style={{ color: "#10b981", alignSelf: "center", height: "fit-content", width: "fit-content" }}>Успешно: {results.tests_result.passed}</span>
            <span className="test-stat-item failed" style={{ color: "#ef4444", alignSelf: "center", height: "fit-content", width: "fit-content" }}>Упало: {results.tests_result.failed}</span>
          </div>

          {/* Контейнер с возможностью прокрутки (серый скролл) */}
          <div className="test-cases-scroll-container">
            {sortedDetails.map((detail) => {
              const showDetails = !detail.passed && (isAuthor || !detail.is_hidden);
              const isHidden = !detail.passed && !isAuthor && detail.is_hidden;

              return (
                <div
                  key={detail.originalIdx}
                  className={`test-case-detail ${detail.passed ? "passed" : "failed"}`}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    background: detail.passed ? "#f0fdf4" : "#fef2f2"
                  }}
                >
                  <div className="test-case-title">
                    Тест #{detail.originalIdx + 1} {detail.passed ? "Пройден" : "Упал"}
                  </div>

                  {showDetails && (
                    <div className="test-case-io-details" style={{ fontSize: "0.85rem", display: "grid", gap: "0.5rem" }}>
                      <div className="test-case-io-block stdin">
                        <strong className="test-case-io-label" style={{ color: "#64748b" }}>Ввод (stdin):</strong>
                        <pre className="test-case-io-pre" style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", fontFamily: "monospace" }}>
                          {detail.input}
                        </pre>
                      </div>
                      <div className="test-case-io-block expected">
                        <strong className="test-case-io-label" style={{ color: "#64748b" }}>Ожидалось (stdout):</strong>
                        <pre className="test-case-io-pre" style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", fontFamily: "monospace" }}>
                          {detail.expected}
                        </pre>
                      </div>
                      <div className="test-case-io-block actual">
                        <strong className="test-case-io-label" style={{ color: "#64748b" }}>
                          {isAuthor ? "Реальный вывод:" : "Ваш вывод:"}
                        </strong>
                        {detail.actual && detail.actual.trim() ? (
                          <pre className="test-case-io-pre" style={{ margin: 0, padding: "0.25rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#b91c1c", fontFamily: "monospace" }}>
                            {detail.actual}
                          </pre>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", marginLeft: "0.5rem" }}></span>
                        )}
                      </div>
                    </div>
                  )}

                  {isHidden && (
                    <div className="test-case-hidden-notice" style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Скрытый тест. Детали не отображаются.
                    </div>
                  )}

                  {/* --- РАЗДЕЛ ДЕБАГА ДЛЯ АВТОРА --- */}
                  {isAuthor && (
                    <div
                      className="test-case-debug-panel"
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.5rem",
                        background: "#1e293b",
                        color: "#e2e8f0",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontFamily: "monospace"
                      }}
                    >
                      <strong className="test-case-debug-title" style={{ color: "#94a3b8", display: "block", marginBottom: "0.5rem", fontFamily: "sans-serif" }}>
                        🛠 лог Piston:
                      </strong>
                      {detail.raw_stdout && (
                        <div className="test-case-debug-section stdout" style={{ marginBottom: "0.5rem" }}>
                          <span className="test-case-debug-label" style={{ color: "#4ade80", fontWeight: "bold" }}>[STDOUT]</span>
                          <br />
                          <pre className="test-case-debug-pre" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>
                            {detail.raw_stdout}
                          </pre>
                        </div>
                      )}
                      {detail.raw_stderr && (
                        <div className="test-case-debug-section stderr">
                          <span className="test-case-debug-label" style={{ color: "#f87171", fontWeight: "bold" }}>[STDERR]</span>
                          <br />
                          <pre className="test-case-debug-pre" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>
                            {detail.raw_stderr}
                          </pre>
                        </div>
                      )}
                      {!detail.raw_stdout && !detail.raw_stderr && (
                        <span className="test-case-debug-empty" style={{ color: "#b8c4d4ff" }}>
                          Вывод абсолютно пуст. Возможно, функция ничего не возвращает или не была вызвана.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
