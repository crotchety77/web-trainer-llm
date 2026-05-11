import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { ToastProvider } from "../hooks/useToast";
import { apiRequest } from "../lib/api";

let mockUser;

vi.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({
    user: mockUser,
    loading: false,
    error: ""
  })
}));

vi.mock("../lib/api", () => ({
  apiRequest: vi.fn(),
  getApiUrl: () => "http://localhost:5000"
}));

vi.mock("../lib/auth", () => ({
  clearToken: vi.fn(),
  getAuthHeaders: () => ({
    Authorization: "Bearer test-token"
  })
}));

function renderDashboard() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("DashboardPage API key settings", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    mockUser = {
      id: 7,
      name: "Student",
      email: "student@example.com",
      role: "author",
      has_llm_api_key: false,
      has_llm_folder_id: false
    };
  });

  it("shows unavailable status when no personal API key is configured", () => {
    renderDashboard();

    expect(screen.getByText("Assistant chat is unavailable until you add a personal API key and Folder ID.")).toBeInTheDocument();
  });

  it("rejects invalid API key input before sending a request", () => {
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Personal Yandex API key"), {
      target: { value: "too short" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));

    expect(apiRequest).not.toHaveBeenCalledWith("/api/auth/me/api-key", expect.anything());
    expect(screen.getByText("API key must be 20-300 characters and must not contain spaces.")).toBeInTheDocument();
  });

  it("saves a personal API key", async () => {
    apiRequest.mockResolvedValueOnce({ has_llm_api_key: true });
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Personal Yandex API key"), {
      target: { value: "yandex-api-key-1234567890" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/auth/me/api-key", {
        method: "PUT",
        headers: {
          Authorization: "Bearer test-token"
        },
        body: JSON.stringify({ apiKey: "yandex-api-key-1234567890" })
      });
    });
  });

  it("deletes a configured personal API key", async () => {
    mockUser = {
      ...mockUser,
      has_llm_api_key: true
    };
    apiRequest.mockResolvedValueOnce({ has_llm_api_key: false });
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Delete key" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/auth/me/api-key", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer test-token"
        }
      });
    });
  });

  it("saves a personal Folder ID", async () => {
    apiRequest.mockResolvedValueOnce({ has_llm_folder_id: true });
    renderDashboard();

    fireEvent.change(screen.getByLabelText("Personal Yandex Folder ID"), {
      target: { value: "folder-id_123" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Folder ID" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/auth/me/folder-id", {
        method: "PUT",
        headers: {
          Authorization: "Bearer test-token"
        },
        body: JSON.stringify({ folderId: "folder-id_123" })
      });
    });
  });

  it("deletes a configured Folder ID", async () => {
    mockUser = {
      ...mockUser,
      has_llm_folder_id: true
    };
    apiRequest.mockResolvedValueOnce({ has_llm_folder_id: false });
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Delete Folder ID" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/auth/me/folder-id", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer test-token"
        }
      });
    });
  });
});
