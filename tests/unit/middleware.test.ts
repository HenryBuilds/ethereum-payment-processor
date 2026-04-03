import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/env", () => ({
  env: {
    API_KEY: "test-api-key-123",
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX: 100,
  },
}));

import { apiKeyAuth } from "../../src/middleware";

function mockReq(overrides: Record<string, any> = {}) {
  return {
    path: "/payments",
    headers: {},
    ip: "127.0.0.1",
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe("apiKeyAuth middleware", () => {
  it("allows requests to /health without API key", () => {
    const req = mockReq({ path: "/health" });
    const res = mockRes();
    const next = vi.fn();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects requests without API key", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain("Missing API key");
  });

  it("rejects requests with wrong API key", () => {
    const req = mockReq({ headers: { "x-api-key": "wrong-key" } });
    const res = mockRes();
    const next = vi.fn();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain("Invalid API key");
  });

  it("allows requests with correct API key", () => {
    const req = mockReq({ headers: { "x-api-key": "test-api-key-123" } });
    const res = mockRes();
    const next = vi.fn();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
