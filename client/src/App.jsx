import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import LearnPage from "./pages/LearnPage";
import AuthorDashboardPage from "./pages/AuthorDashboardPage";
import AuthorCourseEditorPage from "./pages/AuthorCourseEditorPage";
import AuthorCourseContentEditorPage from "./pages/AuthorCourseContentEditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/courses" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["student", "author"]}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      <Route path="/learn/:courseId/:lessonId" element={<LearnPage />} />
      <Route
        path="/author/dashboard"
        element={
          <ProtectedRoute roles={["author"]}>
            <AuthorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/author/courses/new"
        element={
          <ProtectedRoute roles={["author"]}>
            <AuthorCourseEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/author/courses/:id/edit"
        element={
          <ProtectedRoute roles={["author"]}>
            <AuthorCourseEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/author/courses/:id/content"
        element={
          <ProtectedRoute roles={["author"]}>
            <AuthorCourseContentEditorPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
