import { describe, expect, it } from "vitest";
import { canPersistApiProbe, defaultApiUrl, normalizeApiUrl } from "./shared";

const ANDROID_DEFAULT = "http://10.0.2.2:8000";
const OTHER_DEFAULT = "http://localhost:8000";
const FALLBACK = "http://127.0.0.1:9000";

describe("defaultApiUrl", () => {
  it.each([
    { platform: "android", envUrl: undefined, expected: ANDROID_DEFAULT },
    { platform: "android", envUrl: null, expected: ANDROID_DEFAULT },
    { platform: "android", envUrl: "   ", expected: ANDROID_DEFAULT },
    { platform: "ios", envUrl: undefined, expected: OTHER_DEFAULT },
    { platform: "web", envUrl: "", expected: OTHER_DEFAULT },
  ] as const)(
    "uses platform default when env is empty ($platform / $envUrl)",
    ({ platform, envUrl, expected }) => {
      expect(defaultApiUrl(platform, envUrl)).toBe(expected);
    },
  );

  it.each([
    {
      name: "strips trailing slashes from a valid env URL",
      envUrl: "https://api.example.com/v1///",
      expected: "https://api.example.com/v1",
    },
    {
      name: "falls back for an invalid URL",
      envUrl: "not a url",
      expected: ANDROID_DEFAULT,
    },
    {
      name: "falls back for ftp",
      envUrl: "ftp://api.example.com",
      expected: ANDROID_DEFAULT,
    },
    {
      name: "falls back when credentials are present",
      envUrl: "https://user:pass@api.example.com",
      expected: ANDROID_DEFAULT,
    },
  ])("$name", ({ envUrl, expected }) => {
    expect(defaultApiUrl("android", envUrl)).toBe(expected);
  });
});

describe("normalizeApiUrl", () => {
  it("uses fallback when input is empty", () => {
    expect(normalizeApiUrl("", FALLBACK)).toBe(FALLBACK);
    expect(normalizeApiUrl("   ", FALLBACK)).toBe(FALLBACK);
  });

  it("keeps a valid subpath", () => {
    expect(normalizeApiUrl("https://api.example.com/research/v2/", FALLBACK)).toBe(
      "https://api.example.com/research/v2",
    );
  });

  it.each([
    { input: "ftp://api.example.com", label: "illegal protocol" },
    { input: "ws://api.example.com", label: "websocket protocol" },
    { input: "https://user@api.example.com", label: "username credential" },
    { input: "https://user:secret@api.example.com/v1", label: "user:pass credential" },
  ])("rejects $label", ({ input }) => {
    expect(() => normalizeApiUrl(input, FALLBACK)).toThrow();
  });
});

describe("canPersistApiProbe", () => {
  it("only accepts reachable compatible backends", () => {
    expect(canPersistApiProbe("connected")).toBe(true);
    expect(canPersistApiProbe("auth_required")).toBe(true);
    expect(canPersistApiProbe("incompatible")).toBe(false);
    expect(canPersistApiProbe("timeout")).toBe(false);
    expect(canPersistApiProbe("network")).toBe(false);
  });
});
