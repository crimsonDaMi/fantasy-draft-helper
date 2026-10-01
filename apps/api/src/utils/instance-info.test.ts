import { describe, expect, it } from "vitest";

import { readInstanceInfo } from "./instance-info.js";

describe("readInstanceInfo", () => {
  it("returns the configured operator, trimmed", () => {
    expect(
      readInstanceInfo(
        {
          OPERATOR_NAME: " Test Operator ",
          OPERATOR_CONTACT: "privacy@example.com",
          OPERATOR_ADDRESS: "1 Example Street, 12345 Example City",
        },
        730,
      ),
    ).toEqual({
      operator: {
        name: "Test Operator",
        contact: "privacy@example.com",
        address: "1 Example Street, 12345 Example City",
      },
      accountRetentionDays: 730,
    });
  });

  it("leaves out an empty address", () => {
    expect(
      readInstanceInfo(
        { OPERATOR_NAME: "Test Operator", OPERATOR_CONTACT: "x@example.com" },
        0,
      ).operator,
    ).toEqual({ name: "Test Operator", contact: "x@example.com" });
  });

  it("has no operator unless both name and contact are set", () => {
    expect(readInstanceInfo({}, 730)).toEqual({ accountRetentionDays: 730 });
    expect(
      readInstanceInfo({ OPERATOR_NAME: "Test Operator" }, 730).operator,
    ).toBeUndefined();
    expect(
      readInstanceInfo({ OPERATOR_CONTACT: "x@example.com" }, 730).operator,
    ).toBeUndefined();
  });
});
