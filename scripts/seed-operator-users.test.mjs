import { describe, expect, it } from "vitest";
import {
  buildSeedUsers,
  isProductionUrl,
  normalizeBaseUrl,
  parseArgs,
} from "./seed-operator-users.mjs";

describe("operator user seed", () => {
  it("builds deterministic users for every supported employee role", () => {
    const config = parseArgs([
      "--staff=2",
      "--drivers=1",
      "--assistants=1",
      "--email-prefix=e2e",
      "--email-domain=example.test",
    ]);

    const users = buildSeedUsers(config);

    expect(users).toHaveLength(4);
    expect(users.map((user) => user.role)).toEqual([
      "OPERATOR_STAFF",
      "OPERATOR_STAFF",
      "DRIVER",
      "ASSISTANT",
    ]);
    expect(users.map((user) => user.email)).toEqual([
      "e2e.staff.01@example.test",
      "e2e.staff.02@example.test",
      "e2e.driver.01@example.test",
      "e2e.assistant.01@example.test",
    ]);
    expect(new Set(users.map((user) => user.phone)).size).toBe(4);
  });

  it("rejects invalid counts and unknown arguments", () => {
    expect(() => parseArgs(["--staff=-1"])).toThrow(
      "staff must be a non-negative integer.",
    );
    expect(() => parseArgs(["--unknown"])).toThrow(
      "Unknown argument: --unknown",
    );
  });

  it("normalizes base URLs and identifies the production API", () => {
    expect(normalizeBaseUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000",
    );
    expect(isProductionUrl("https://api.vietride.online")).toBe(true);
    expect(isProductionUrl("https://staging-api.vietride.online")).toBe(false);
  });
});
