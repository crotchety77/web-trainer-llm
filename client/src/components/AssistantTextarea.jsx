import { useEffect, useRef } from "react";

export default function AssistantTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  ariaLabel = "Assistant message"
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <textarea
      ref={textareaRef}
      className="assistant-textarea"
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
    />
  );
}
