#!/usr/bin/env node
// One-time migration for deployments that connected a bank before multi-bank
// support: that bank lives at `session:default` with no entry in
// `connection_index`. The index is now the only list of connections, so add the
// entry. The id stays "default", so OAuth grants scoped to it keep working.
//
// The currently deployed code already reads such an entry, so run this before
// deploying the version that needs it.
//
//   node scripts/migrate-default-connection.mjs <BANKING_KV namespace id>          # dry run
//   node scripts/migrate-default-connection.mjs <BANKING_KV namespace id> --apply  # write
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The index with the default connection added, or null when there is nothing to do. */
export function withDefaultConnection(index, session, now = new Date().toISOString()) {
  const connections = index?.connections ?? [];
  if (!session || connections.some((c) => c.id === "default")) return null;
  const entry = {
    id: "default",
    label: session.label || "Default",
    psuType: session.psuType || "personal",
    aspspName: session.aspspName,
    aspspCountry: session.aspspCountry,
    validUntil: session.consentValidUntil,
    createdAt: session.createdAt,
  };
  return { connections: [entry, ...connections], updatedAt: now };
}

function main([namespaceId, flag]) {
  if (!namespaceId) {
    console.error("Usage: node scripts/migrate-default-connection.mjs <BANKING_KV namespace id> [--apply]");
    process.exit(1);
  }
  const wrangler = (args) =>
    execFileSync("npx", ["wrangler", "kv", "key", ...args, "--namespace-id", namespaceId, "--remote"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  // A missing key is a 404; any other failure aborts, so a bad read can never drop index entries.
  const read = (key) => {
    let raw;
    try {
      raw = wrangler(["get", key]);
    } catch (error) {
      if (String(error.stderr).includes("404: Not Found")) return null;
      throw error;
    }
    return JSON.parse(raw);
  };

  const next = withDefaultConnection(read("connection_index"), read("session:default"));
  if (!next) {
    console.log("Nothing to migrate: no session:default, or it is already in connection_index.");
    return;
  }
  console.log(`New connection_index entry: ${JSON.stringify(next.connections[0])}`);
  console.log(`connection_index will list ${next.connections.length}: ${next.connections.map((c) => c.label).join(", ")}`);
  if (flag !== "--apply") {
    console.log("Dry run. Re-run with --apply to write it.");
    return;
  }
  wrangler(["put", "connection_index", JSON.stringify(next)]);
  console.log("connection_index updated.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
