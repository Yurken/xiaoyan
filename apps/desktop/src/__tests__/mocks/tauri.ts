import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

type InvokeMock = ReturnType<typeof vi.fn>;

export function getInvokeMock(): InvokeMock {
  return vi.mocked(invoke);
}

export function mockInvokeOnce(command: string, result: unknown) {
  getInvokeMock().mockImplementationOnce(async (cmd: string) => {
    if (cmd === command) return result;
    return undefined;
  });
}

export function mockInvoke(commands: Record<string, unknown>) {
  getInvokeMock().mockImplementation(async (cmd: string) => {
    if (cmd in commands) return commands[cmd];
    throw new Error(`Unmocked invoke: ${cmd}`);
  });
}

export function mockInvokeError(command: string, message: string) {
  getInvokeMock().mockImplementationOnce(async (cmd: string) => {
    if (cmd === command) throw new Error(message);
    return undefined;
  });
}

export function resetInvokeMock() {
  getInvokeMock().mockReset();
}

// Common mock data factories
export function createMockPaper(overrides: Record<string, unknown> = {}) {
  return {
    id: "paper-1",
    title: "Test Paper",
    authors: "Author A, Author B",
    year: 2024,
    abstract: "Test abstract",
    venue: "Test Venue",
    doi: "10.1234/test",
    ccfRating: "A",
    wosIndex: "SCI",
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    title: "Test Experiment",
    config: '{"lr": 0.001}',
    result: "Test result",
    notes: "Test notes",
    linkedSubmissionId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockChatSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    title: "Test Session",
    mode: "direct",
    interestId: null,
    pinned: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockInterest(overrides: Record<string, unknown> = {}) {
  return {
    id: "interest-1",
    name: "Test Interest",
    description: "Test description",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    title: "Test Submission",
    venueId: "venue-1",
    status: "draft",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    title: "Test Note",
    content: "Test content",
    interestId: "interest-1",
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockSettings(overrides: Record<string, unknown> = {}) {
  return {
    llmProvider: "openai",
    llmModel: "gpt-4",
    apiKey: "test-key",
    apiBaseUrl: "",
    multiAgentEnabled: false,
    theme: "auto",
    layoutMode: "landscape",
    ...overrides,
  };
}
