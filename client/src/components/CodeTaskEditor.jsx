import CodeEditor from "./CodeEditor";
import CodeTaskTestResults from "./CodeTaskTestResults";

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
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>Добавьте входные данные (stdin) и ожидаемый вывод (stdout).</p>
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
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const newTestCases = testCases.filter((_, i) => i !== idx);
                updateQuizData({ ...quizData, task_type: "code", test_cases: newTestCases });
              }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", color: "var(--error-color, #ef4444)", borderColor: "#e2e8f0" }}
              title="Удалить тест-кейс"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
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
          title={isTestingCode ? "Отправляем запрос к Piston API..." : "Запустить код и проверить тесты"}
        >
          {isTestingCode ? "⏳ Выполнение в песочнице..." : "▶ Запустить тесты"}
        </button>

        {authorTestResults && (
          <div style={{ marginTop: "1rem" }}>
            <CodeTaskTestResults results={authorTestResults} isAuthor={true} />
          </div>
        )}
      </div>
    </div>
  );
}
