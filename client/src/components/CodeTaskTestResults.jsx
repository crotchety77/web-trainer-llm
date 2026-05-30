import React from "react";

export default function CodeTaskTestResults({ results, isAuthor = false }) {
  if (!results) return null;

  const isSuccess = results.status === "passed" || results.status === "accepted";
  const sortedDetails = (results.tests_result?.details || [])
    .map((detail, idx) => ({ ...detail, originalIdx: idx }))
    .sort((a, b) => {
      if (a.passed === b.passed) return 0;
      return a.passed ? 1 : -1;
    });

  let statusText = results.status || "Результат";
  if (results.status === "passed" || results.status === "accepted") {
    statusText = "Успешно";
  } else if (results.status === "failed" || results.status === "error") {
    statusText = "Ошибка";
  }

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
    <div className="code-task-results-wrapper">
      {isAuthor ? (
        <div className={`check-result ${isSuccess ? "success-result" : "error-result"}`}>
          <span className="result-status-title">{statusText}</span>
          <p className={`result-message-text ${isSuccess ? "result-text-success" : "result-text-error"}`}>
            {messageText}
          </p>
        </div>
      ) : null}

      {results.tests_result ? (
        <div className="test-stats">
          <div className="test-stats-summary">
            <span className="test-stat-item total">Всего: {results.tests_result.total}</span>
            <span className="test-stat-item passed">Успешно: {results.tests_result.passed}</span>
            <span className="test-stat-item failed">Упало: {results.tests_result.failed}</span>
          </div>

          <div className="test-cases-scroll-container">
            {sortedDetails.map((detail) => {
              const showDetails = !detail.passed && (isAuthor || !detail.is_hidden);
              const isHidden = !detail.passed && !isAuthor && detail.is_hidden;

              return (
                <div
                  key={detail.originalIdx}
                  className={`test-case-detail ${detail.passed ? "passed" : "failed"}`}
                >
                  <div className="test-case-title">
                    Тест #{detail.originalIdx + 1} {detail.passed ? "Пройден" : "Упал"}
                  </div>

                  {showDetails ? (
                    <div className="test-case-io-details">
                      <div className="test-case-io-block stdin">
                        <strong className="test-case-io-label">Ввод (stdin):</strong>
                        <pre className="test-case-io-pre">{detail.input}</pre>
                      </div>
                      <div className="test-case-io-block expected">
                        <strong className="test-case-io-label">Ожидалось (stdout):</strong>
                        <pre className="test-case-io-pre">{detail.expected}</pre>
                      </div>
                      <div className="test-case-io-block actual">
                        <strong className="test-case-io-label">
                          {isAuthor ? "Реальный вывод:" : "Ваш вывод:"}
                        </strong>
                        {detail.actual && detail.actual.trim() ? (
                          <pre className="test-case-io-pre actual-output">{detail.actual}</pre>
                        ) : (
                          <span className="test-case-empty-output" />
                        )}
                      </div>
                    </div>
                  ) : null}

                  {isHidden ? (
                    <div className="test-case-hidden-notice">
                      Скрытый тест. Детали не отображаются.
                    </div>
                  ) : null}

                  {isAuthor ? (
                    <div className="test-case-debug-panel">
                      <strong className="test-case-debug-title">Лог Piston:</strong>
                      {detail.raw_stdout ? (
                        <div className="test-case-debug-section stdout">
                          <span className="test-case-debug-label stdout">[STDOUT]</span>
                          <pre className="test-case-debug-pre">{detail.raw_stdout}</pre>
                        </div>
                      ) : null}
                      {detail.raw_stderr ? (
                        <div className="test-case-debug-section stderr">
                          <span className="test-case-debug-label stderr">[STDERR]</span>
                          <pre className="test-case-debug-pre">{detail.raw_stderr}</pre>
                        </div>
                      ) : null}
                      {!detail.raw_stdout && !detail.raw_stderr ? (
                        <span className="test-case-debug-empty">
                          Вывод абсолютно пуст. Возможно, функция ничего не возвращает или не была вызвана.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
