import { describe, it, expect } from "vitest";
import { withDefaultConnection } from "../scripts/migrate-default-connection.mjs";

const session = {
  aspspName: "Danske Bank",
  aspspCountry: "DK",
  consentValidUntil: "2027-01-10T14:32:37Z",
  createdAt: "2026-10-12T14:33:17Z",
  label: "Privat",
};
const other = { id: "conn_1", label: "Holding", psuType: "business", aspspName: "Nordea", aspspCountry: "DK", validUntil: "", createdAt: "" };

describe("migrate-default-connection", () => {
  it("adds the legacy default session to the index under its old id, first", () => {
    const next = withDefaultConnection({ connections: [other], updatedAt: "" }, session, "now");
    expect(next).toEqual({
      connections: [
        { id: "default", label: "Privat", psuType: "personal", aspspName: "Danske Bank", aspspCountry: "DK", validUntil: "2027-01-10T14:32:37Z", createdAt: "2026-10-12T14:33:17Z" },
        other,
      ],
      updatedAt: "now",
    });
  });

  it("creates the index when there is none", () => {
    expect(withDefaultConnection(null, { ...session, label: undefined })!.connections[0].label).toBe("Default");
  });

  it("does nothing without a default session or when already migrated", () => {
    expect(withDefaultConnection({ connections: [other], updatedAt: "" }, null)).toBeNull();
    const migrated = withDefaultConnection(null, session)!;
    expect(withDefaultConnection(migrated, session)).toBeNull();
  });
});
