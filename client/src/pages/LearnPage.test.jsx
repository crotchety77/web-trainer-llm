import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./LearnPage";
import { apiRequest } from "../lib/api";
import { ToastProvider } from "../hooks/useToast";

vi.mock("../lib/api", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../components/CodeEditor", () => ({
  default: ({ ariaLabel, value, onChange }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

vi.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({
    user: {
      id: 7,
      name: "Student",
      role: "student",
      has_llm_api_key: true,
      has_llm_folder_id: true
    }
  })
}));

vi.mock("../lib/auth", () => ({
  clearToken: vi.fn(),
  getAuthHeaders: () => ({
    Authorization: "Bearer test-token"
  })
}));

const lessons = [
  { id: 10, title: "Intro", position: 1 },
  { id: 11, title: "Practice", position: 2 }
];

const lesson = {
  id: 10,
  course_id: 3,
  course_title: "JavaScript Basics",
  position: 1,
  title: "Intro",
  blocks: [
    {
      id: 101,
      type: "lecture",
      title: "Theory",
      content: "Read this theory first.",
      attachment_url: "https://example.com/theory.pdf",
      position: 1
    },
    {
      id: 102,
      type: "practice",
      title: "Write code",
      content: "Return true from solve.",
      attachment_url: "",
      position: 1
    },
    {
      id: 103,
      type: "test",
      title: "Final check",
      content: "Submit final answer.",
      attachment_url: "",
      position: 1
    }
  ]
};

function renderLearnPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/learn/3/10"]}>
        <Routes>
          <Route path="/learn/:courseId/:lessonId" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("LearnPage", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path) => {
      if (path === "/api/courses/3/lessons") {
        return Promise.resolve({ lessons });
      }

      if (path === "/api/lessons/10") {
        return Promise.resolve({ lesson });
      }

      if (path === "/api/blocks/102/submissions") {
        return Promise.resolve({
          submission: {
            id: 1,
            status: "accepted",
            result_message: "Solution submitted successfully.",
            tests_result: {
              total: 1,
              passed: 1,
              failed: 0
            }
          }
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  it("loads lessons and renders theory, practice, and test blocks", async () => {
    renderLearnPage();

    expect(screen.getByText("Loading lesson...")).toBeInTheDocument();
    expect(await screen.findByText("JavaScript Basics")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "1. Intro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1Intro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2Practice" })).toBeInTheDocument();
    expect(screen.getByText("Read this theory first.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attachment" })).toHaveAttribute(
      "href",
      "https://example.com/theory.pdf"
    );
    expect(screen.getByLabelText("Solution code for Write code")).toBeInTheDocument();
    expect(screen.getByLabelText("Solution code for Final check")).toBeInTheDocument();
  });

  it("submits code for a practice block and shows the result", async () => {
    renderLearnPage();

    const editor = await screen.findByLabelText("Solution code for Write code");
    fireEvent.change(editor, { target: { value: "function solve() { return true; }" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Submit solution" })[0]);

    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/blocks/102/submissions", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token"
        },
        body: JSON.stringify({
          code: "function solve() { return true; }",
          language: "javascript"
        })
      });
    });
    expect(await screen.findByText("Solution submitted successfully.")).toBeInTheDocument();
  });

  it("keeps code and shows an error when submission fails", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/courses/3/lessons") {
        return Promise.resolve({ lessons });
      }

      if (path === "/api/lessons/10") {
        return Promise.resolve({ lesson });
      }

      if (path === "/api/blocks/102/submissions") {
        return Promise.reject(new Error("Failed to submit solution"));
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderLearnPage();

    const editor = await screen.findByLabelText("Solution code for Write code");
    fireEvent.change(editor, { target: { value: "bad code" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Submit solution" })[0]);

    expect(await screen.findByText("Failed to submit solution")).toBeInTheDocument();
    expect(editor).toHaveValue("bad code");
  });

  it("shows a validation error when solution code is empty", async () => {
    renderLearnPage();

    await screen.findByLabelText("Solution code for Write code");
    fireEvent.click(screen.getAllByRole("button", { name: "Submit solution" })[0]);

    expect(await screen.findByText("Пожалуйста, введите код решения перед отправкой.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/api/blocks/102/submissions",
      expect.anything()
    );
  });

  it("sends slim lesson context and detailed @step context to AI chat", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/courses/3/lessons") {
        return Promise.resolve({ lessons });
      }

      if (path === "/api/lessons/10") {
        return Promise.resolve({ lesson });
      }

      if (path === "/api/ai/chat") {
        return Promise.resolve({ message: { role: "assistant", text: "Try checking step 2." } });
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderLearnPage();

    const editor = await screen.findByLabelText("Solution code for Write code");
    fireEvent.change(editor, { target: { value: "function solve() { return false; }" } });

    const input = screen.getByPlaceholderText(/@step2 почему у меня ошибка/);
    fireEvent.change(input, { target: { value: "@step2 why error?" } });
    expect(screen.getByText("@step2")).toBeInTheDocument();

    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/ai/chat", expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-token"
        },
        body: expect.any(String)
      }));
    });

    const aiCall = apiRequest.mock.calls.find(([path]) => path === "/api/ai/chat");
    const payload = JSON.parse(aiCall[1].body);

    expect(payload.userInput).toBe("@step2 why error?");
    expect(payload.lessonContext).toContain("Урок: Intro");
    expect(payload.lessonContext).toContain("2. Write code");
    expect(payload.lessonContext).not.toContain("Return true from solve.");
    expect(payload.stepsContext).toEqual([
      expect.objectContaining({
        stepNumber: 2,
        blockId: 102,
        title: "Write code",
        task: "Return true from solve.",
        studentCode: "function solve() { return false; }"
      })
    ]);
  });

  it("shows lesson loading errors without crashing", async () => {
    apiRequest.mockRejectedValue(new Error("You do not have access to this lesson"));

    renderLearnPage();

    expect(await screen.findByText("Не удалось загрузить урок")).toBeInTheDocument();
  });
});
