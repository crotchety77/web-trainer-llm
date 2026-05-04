import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./LearnPage";
import { apiRequest } from "../lib/api";

vi.mock("../lib/api", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({
    user: {
      id: 7,
      name: "Student",
      role: "student"
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
    <MemoryRouter initialEntries={["/learn/3/10"]}>
      <Routes>
        <Route path="/learn/:courseId/:lessonId" element={<LearnPage />} />
      </Routes>
    </MemoryRouter>
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

    expect(screen.getAllByText("1. Intro")).toHaveLength(2);
    expect(screen.getByText("2. Practice")).toBeInTheDocument();
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

    expect(await screen.findByText("Enter your solution code before submitting.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/api/blocks/102/submissions",
      expect.anything()
    );
  });

  it("shows lesson loading errors without crashing", async () => {
    apiRequest.mockRejectedValue(new Error("You do not have access to this lesson"));

    renderLearnPage();

    expect(await screen.findByText("You do not have access to this lesson")).toBeInTheDocument();
  });
});
