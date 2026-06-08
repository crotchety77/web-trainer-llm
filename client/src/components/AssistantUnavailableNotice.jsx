import { Link } from "react-router-dom";

export default function AssistantUnavailableNotice() {
  return (
    <p>
      Чат недоступен. <Link to="/dashboard">Добавьте API ключ и Folder ID</Link>.
    </p>
  );
}
