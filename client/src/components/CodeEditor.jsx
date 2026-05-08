import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

const LANGUAGE_MAP = {
  "javascript": "javascript",
  "js": "javascript",
  "python": "python",
  "py": "python",
  "java": "java",
  "c++": "cpp",
  "cpp": "cpp"
};

/**
 * Переиспользуемый компонент редактора кода на основе Monaco Editor.
 * @param {string} value - Текущее значение кода
 * @param {Function} onChange - Обработчик изменений
 * @param {string} language - Язык программирования
 * @param {number} height - Высота редактора (по умолчанию 250)
 * @param {string} placeholder - Текст-подсказка (не поддерживается Monaco нативно)
 * @param {boolean} readOnly - Только чтение
 */
export default function CodeEditor({
  value = "",
  onChange,
  language = "javascript",
  height = 250,
  readOnly = false
}) {
  const editorRef = useRef(null);

  const monacoLanguage = LANGUAGE_MAP[language] || "plaintext";

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback((newValue) => {
    if (onChange) {
      onChange(newValue || "");
    }
  }, [onChange]);

  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden" }}>
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          readOnly: readOnly,
          padding: { top: 8, bottom: 8 }
        }}
      />
    </div>
  );
}
