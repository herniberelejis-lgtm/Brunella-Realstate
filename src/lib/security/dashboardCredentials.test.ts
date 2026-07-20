import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkDashboardCredentials } from "./dashboardCredentials";

function basic(user: string, password: string): string {
  return "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
}

describe("checkDashboardCredentials", () => {
  const originalUser = process.env.DASHBOARD_USER;
  const originalPassword = process.env.DASHBOARD_PASSWORD;

  beforeEach(() => {
    process.env.DASHBOARD_USER = "brunella";
    process.env.DASHBOARD_PASSWORD = "secreto123";
  });

  afterEach(() => {
    process.env.DASHBOARD_USER = originalUser;
    process.env.DASHBOARD_PASSWORD = originalPassword;
  });

  it("accepts the configured credentials", () => {
    expect(checkDashboardCredentials(basic("brunella", "secreto123"))).toBe(true);
  });

  it("rejects wrong password", () => {
    expect(checkDashboardCredentials(basic("brunella", "otra"))).toBe(false);
  });

  it("rejects wrong user", () => {
    expect(checkDashboardCredentials(basic("otro", "secreto123"))).toBe(false);
  });

  it("rejects a missing or non-Basic header", () => {
    expect(checkDashboardCredentials(null)).toBe(false);
    expect(checkDashboardCredentials("Bearer abc")).toBe(false);
  });

  it("fails closed when the env vars are not configured", () => {
    delete process.env.DASHBOARD_USER;
    delete process.env.DASHBOARD_PASSWORD;
    expect(checkDashboardCredentials(basic("", ""))).toBe(false);
    expect(checkDashboardCredentials(basic("brunella", "secreto123"))).toBe(false);
  });
});
