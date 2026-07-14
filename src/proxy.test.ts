import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("dashboard auth proxy", () => {
  beforeEach(() => {
    process.env.DASHBOARD_USER = "brunella";
    process.env.DASHBOARD_PASSWORD = "supersecret";
  });

  it("skips auth for the Telegram webhook route", () => {
    const request = new NextRequest("https://example.com/api/telegram/webhook");
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("skips auth for the cron route", () => {
    const request = new NextRequest("https://example.com/api/cron/recordatorios");
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("rejects dashboard requests without credentials", () => {
    const request = new NextRequest("https://example.com/contactos");
    const response = proxy(request);
    expect(response.status).toBe(401);
  });

  it("accepts dashboard requests with correct Basic Auth credentials", () => {
    const encoded = Buffer.from("brunella:supersecret").toString("base64");
    const request = new NextRequest("https://example.com/contactos", {
      headers: { authorization: `Basic ${encoded}` },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("rejects dashboard requests with wrong credentials", () => {
    const encoded = Buffer.from("brunella:wrongpassword").toString("base64");
    const request = new NextRequest("https://example.com/contactos", {
      headers: { authorization: `Basic ${encoded}` },
    });
    const response = proxy(request);
    expect(response.status).toBe(401);
  });
});
