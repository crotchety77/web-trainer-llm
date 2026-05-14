import CodeEditor from "./CodeEditor";

export default function CodeTaskEditor({
  blockId,
  quizData,
  updateQuizData,
  authorTestCode,
  setAuthorTestCode,
  handleAuthorTestSubmit,
  authorTestResults,
  isTestingCode
}) {
  const testCases = quizData?.test_cases || [];

  return (
    <div className="author-practice-editor" style={{ marginTop: "1rem", padding: "1.5rem", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: "8px", background: "#fff" }}>
      <div className="author-panel-header" style={{ marginBottom: "1rem" }}>
        <span className="eyebrow">Интерактивное задание</span>
        <h4>Настройки задания с кодом</h4>
      </div>

      <label style={{ display: "block", marginBottom: "1.5rem" }}>
        <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Язык программирования</span>
        <select
          value={quizData?.language || "javascript"}
          onChange={(e) => updateQuizData({
            ...quizData,
            task_type: "code",
            language: e.target.value
          })}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="c++">C++</option>
        </select>
      </label>

      <label style={{ display: "block", marginBottom: "1.5rem" }}>
        <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Имя проверяемой функции (опционально)</span>
        <input
          type="text"
          placeholder="например, sum"
          value={quizData?.function_name || ""}
          onChange={(e) => updateQuizData({
            ...quizData,
            task_type: "code",
            function_name: e.target.value
          })}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
        />
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Если указано, система сама вызовет эту функцию (только для JS и Python).</span>
      </label>

      <div style={{ marginBottom: "1.5rem" }}>
        <span style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Стартовый код для студента</span>
        <CodeEditor
          value={quizData?.placeholder_code || ""}
          onChange={(val) => updateQuizData({
            ...quizData,
            task_type: "code",
            placeholder_code: val
          })}
          language={quizData?.language || "javascript"}
          height={150}
        />
      </div>

      <div className="quiz-options-list" style={{ marginBottom: "2rem" }}>
        <span style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)" }}>Test Benches (Тест-кейсы)</span>
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>Добавьте входные данные (stdin) и ожидаемый вывод (stdout). Важно точное совпадение!</p>
        {testCases.map((tc, idx) => (
          <div
            key={idx}
            className="quiz-option-item"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: "0.75rem",
              alignItems: "start",
              marginBottom: "0.75rem",
              padding: "1rem",
              background: "var(--surface-color, #f8fafc)",
              borderRadius: "6px",
              border: "1px solid #e2e8f0"
            }}
          >
            <label style={{ marginBottom: 0 }}>
              <span style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#64748b" }}>Входные данные (stdin)</span>
              <textarea
                rows="2"
                placeholder="1 2 3"
                value={tc.input || ""}
                onChange={(e) => {
                  const newTestCases = [...testCases];
                  newTestCases[idx].input = e.target.value;
                  updateQuizData({ ...quizData, task_type: "code", test_cases: newTestCases });
                }}
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%", resize: "vertical" }}
              />
            </label>
            <label style={{ marginBottom: 0 }}>
              <span style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#64748b" }}>Ожидаемый вывод (stdout)</span>
              <textarea
                rows="2"
                placeholder="6"
                value={tc.expected_output || ""}
                onChange={(e) => {
                  const newTestCases = [...testCases];
                  newTestCases[idx].expected_output = e.target.value;
                  updateQuizData({ ...quizData, task_type: "code", test_cases: newTestCases });
                }}
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", width: "100%", resize: "vertical" }}
              />
            </label>
            <button type="button" className="secondary-button" onClick={() => {
              const newTestCases = testCases.filter((_, i) => i !== idx);
              updateQuizData({ ...quizData, task_type: "code", test_cases: newTestCases });
            }} style={{ padding: "0.5rem", color: "var(--error-color, #ef4444)", borderColor: "#e2e8f0" }} title="Удалить тест-кейс">✕</button>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={() => {
          updateQuizData({
            ...quizData,
            task_type: "code",
            test_cases: [...testCases, { input: "", expected_output: "", is_hidden: false }]
          });
        }} style={{ marginTop: "0.5rem" }}>+ Добавить тест-кейс</button>
      </div>

      <div className="author-test-panel" style={{ padding: "1rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
        <h5 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "0.9rem", color: "#334155" }}>Тестирование задания</h5>
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>Напишите эталонное решение, чтобы проверить корректность тест-кейсов.</p>
        <div style={{ marginBottom: "1rem" }}>
          <CodeEditor
            value={authorTestCode || quizData?.placeholder_code || ""}
            onChange={setAuthorTestCode}
            language={quizData?.language || "javascript"}
            height={200}
          />
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => handleAuthorTestSubmit(blockId)}
          disabled={isTestingCode}
        >
          {isTestingCode ? "Проверка..." : "Запустить тесты"}
        </button>

        {authorTestResults && (
          <div style={{ marginTop: "1rem" }}>
            <div className={`check-result ${authorTestResults.status === "passed" || authorTestResults.status === "accepted" ? "success-result" : "error-result"}`} style={{ padding: "1rem", borderRadius: "6px", border: "1px solid", borderColor: authorTestResults.status === "passed" || authorTestResults.status === "accepted" ? "#86efac" : "#fca5a5", background: authorTestResults.status === "passed" || authorTestResults.status === "accepted" ? "#f0fdf4" : "#fef2f2" }}>
              <span style={{ fontWeight: "bold", color: authorTestResults.status === "passed" || authorTestResults.status === "accepted" ? "#166534" : "#991b1b" }}>{authorTestResults.status || "Результат"}</span>
              <p style={{ margin: "0.5rem 0", color: authorTestResults.status === "passed" || authorTestResults.status === "accepted" ? "#15803d" : "#b91c1c" }}>{authorTestResults.result_message}</p>
              {authorTestResults.tests_result ? (
                <div className="test-stats" style={{ marginTop: "1rem" }}>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontSize: "0.85rem", fontWeight: "bold" }}>
                    <span>Всего: {authorTestResults.tests_result.total}</span>
                    <span style={{ color: "#10b981" }}>Успешно: {authorTestResults.tests_result.passed}</span>
                    <span style={{ color: "#ef4444" }}>Упало: {authorTestResults.tests_result.failed}</span>
                  </div>

                  {(authorTestResults.tests_result.details || []).map((detail, idx) => (
                    <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "4px", background: detail.passed ? "#f0fdf4" : "#fff" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "0.5rem", fontSize: "0.85rem", color: detail.passed ? "#15803d" : "#b91c1c" }}>
                        Тест #{idx + 1} {detail.passed ? "✓ Пройден" : "✗ Упал"}
                      </div>
                      {!detail.passed && (
                        <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.5rem" }}>
                          <div><strong style={{ color: "#64748b" }}>Ввод (stdin):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px" }}>{detail.input}</pre></div>
                          <div><strong style={{ color: "#64748b" }}>Ожидалось (stdout):</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px" }}>{detail.expected}</pre></div>
                          <div><strong style={{ color: "#64748b" }}>Реальный вывод:</strong><pre style={{ margin: 0, padding: "0.25rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", color: "#b91c1c" }}>{detail.actual}</pre></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
