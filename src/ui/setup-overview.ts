import { alert, badge, card, consentBadge, escapeHtml, flash, icons, page, pageHeader } from "./components";
import { describeClientScope, type McpClientView } from "../mcp-clients";

export interface OverviewConnection {
  id: string;
  label: string;
  psuType: "personal" | "business";
  aspspName: string;
  aspspCountry: string;
  validUntil: string;
  accountCount: number;
}

export interface SetupOverviewState {
  credentialsFromEnv: boolean;
  appId?: string;
  connections: OverviewConnection[];
  /** undefined when the OAuth provider could not be queried. */
  clients?: McpClientView[];
}

const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function sectionHeader(title: string, description: string, count?: string): string {
  return `<div class="section-header">
      <div>
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <p class="section-description">${escapeHtml(description)}</p>
      </div>
      ${count ?? ""}
    </div>`;
}

function bankCard(conn: OverviewConnection): string {
  const expired = new Date(conn.validUntil).getTime() <= Date.now();
  const meta = `${conn.aspspName} · ${conn.psuType === "business" ? "Business" : "Personal"} · ${conn.accountCount} account${conn.accountCount === 1 ? "" : "s"}`;
  const id = escapeHtml(conn.id);
  return card({
    title: conn.label,
    description: meta,
    action: consentBadge(conn.validUntil),
    className: "bank-card",
    content: `<p class="text-muted text-sm" style="margin:0;">${expired ? `Consent expired ${fmtDate(conn.validUntil)}` : `Consent valid until ${fmtDate(conn.validUntil)}`}</p>
      <form action="/connections/rename" method="POST" class="rename-form hidden" id="rename-${id}">
        <input type="hidden" name="connection_id" value="${id}" />
        <input type="text" name="label" value="${escapeHtml(conn.label)}" maxlength="80" required aria-label="Connection name" />
        <button type="submit" class="btn btn-sm">Save</button>
      </form>`,
    footer: `<form action="/auth/start" method="POST">
        <input type="hidden" name="connection_id" value="${id}" />
        <input type="hidden" name="label" value="${escapeHtml(conn.label)}" />
        <input type="hidden" name="psu_type" value="${escapeHtml(conn.psuType)}" />
        <input type="hidden" name="aspsp_id" value="${escapeHtml(conn.aspspName)}" />
        <input type="hidden" name="aspsp_name" value="${escapeHtml(conn.aspspName)}" />
        <input type="hidden" name="country" value="${escapeHtml(conn.aspspCountry)}" />
        <button type="submit" class="${expired ? "btn" : "btn-outline"} btn-sm">${expired ? "Reconnect" : "Renew"}</button>
      </form>
      <button type="button" class="btn-ghost btn-sm" onclick="toggleRename('rename-${id}')">Rename</button>
      <form action="/disconnect" method="POST" class="push-right">
        <input type="hidden" name="connection_id" value="${id}" />
        <button type="submit" class="btn-ghost btn-sm text-destructive" onclick="return confirm('Disconnect ${escapeHtml(conn.label).replace(/'/g, "&#39;")}? Clients will lose access to this bank.')">Disconnect</button>
      </form>`,
  });
}

function clientRow(client: McpClientView, connections: OverviewConnection[]): string {
  const scope = describeClientScope(client.scope, connections);
  const banks = scope.all
    ? badge("All banks", "secondary")
    : scope.labels.map((l) => badge(l, "outline")).join(" ");
  return `<li class="client-row">
      <div class="client-icon">${icons.plug}</div>
      <div class="client-main">
        <div class="client-name">${escapeHtml(client.clientName)}</div>
        <div class="client-meta">Connected ${fmtDate(client.connectedAt)}</div>
        <div class="client-banks"><span class="text-muted text-xs">Can see:</span> ${banks}</div>
      </div>
      <form action="/clients/revoke" method="POST">
        <input type="hidden" name="grant_id" value="${escapeHtml(client.grantId)}" />
        <button type="submit" class="btn-outline btn-sm text-destructive" onclick="return confirm('Revoke access for ${escapeHtml(client.clientName).replace(/'/g, "&#39;")}? It will need to reconnect.')">Revoke</button>
      </form>
    </li>`;
}

export function renderSetupOverview(
  baseUrl: string,
  state: SetupOverviewState,
  error?: string,
  success?: string
): string {
  const mcpUrl = `${baseUrl}/mcp`;
  const banks = state.connections;
  const clients = state.clients;

  const bankSection = `<section class="section" aria-labelledby="banks">
      ${sectionHeader("Bank connections", "Banks you've approved with MitID. Each is one bank login.", badge(`${banks.length} bank${banks.length === 1 ? "" : "s"}`, "secondary"))}
      <div class="stack">${banks.map(bankCard).join("")}</div>
      <form action="/connections/new" method="POST" class="mt-3">
        <button type="submit" class="add-connection-btn">${icons.plus} Add another bank</button>
      </form>
    </section>`;

  const clientList =
    clients === undefined
      ? alert({ variant: "warning", title: "Couldn't load clients", description: "The list of connected apps is unavailable right now." })
      : clients.length === 0
        ? `<p class="empty-state">No apps connected yet. Add the MCP URL above to Claude, ChatGPT or Grok.</p>`
        : `<ul class="client-list">${clients.map((c) => clientRow(c, banks)).join("")}</ul>`;

  const clientSection = `<section class="section" aria-labelledby="clients">
      ${sectionHeader("MCP clients", "Apps that can read your bank data through this server. Each app picks which banks it sees when you approve it.", clients ? badge(`${clients.length} connected`, "secondary") : "")}
      ${card({
        title: "Server URL",
        description: "Add this as a custom MCP server (connector) in your AI app. OAuth handles sign-in.",
        content: `<div class="copy-field">
            <code id="mcpUrl">${escapeHtml(mcpUrl)}</code>
            <button type="button" class="btn-outline btn-sm" onclick="copyText('mcpUrl', this)">${icons.copy}<span>Copy</span></button>
          </div>
          ${alert({ variant: "default", inline: true, description: "Adding a client doesn't add a bank. Use \u201cAdd another bank\u201d above for that." })}
          <details class="ui-collapsible mt-3">
            <summary>${icons.chevronDown} Use a bearer token instead (Cursor, Claude Code)</summary>
            <pre class="code-block pre"><code id="cursorConfig">{
  "mcpServers": {
    "banking": {
      "url": "${escapeHtml(mcpUrl)}",
      "headers": { "Authorization": "Bearer YOUR_AUTH_SECRET" }
    }
  }
}</code></pre>
            <p class="text-muted text-xs">Bearer-token clients see all banks and aren't listed below.</p>
          </details>`,
      })}
      ${card({ title: "Connected apps", content: clientList, className: "mt-3" })}
    </section>`;

  const credentialsForm = state.credentialsFromEnv
    ? `<p class="text-muted text-sm">Credentials are set via environment variables and can't be changed here.</p>`
    : `<form action="/api/credentials" method="POST" class="stack-sm">
        <input type="hidden" name="action" value="save" />
        <div class="ui-field"><label class="ui-label" for="appId">Application ID</label>
          <input type="text" id="appId" name="appId" value="${escapeHtml(state.appId || "")}" required /></div>
        <div class="ui-field"><label class="ui-label" for="privateKey">Private key (PEM)</label>
          <textarea id="privateKey" name="privateKey" rows="4" placeholder="-----BEGIN PRIVATE KEY-----" required></textarea></div>
        <div><button type="submit" class="btn-secondary btn-sm">Update credentials</button></div>
      </form>`;

  const settingsSection = `<section class="section">
      <details class="ui-collapsible settings">
        <summary>${icons.settings} Settings</summary>
        <div class="stack mt-3">
          ${card({
            title: "Enable Banking app",
            description: "The API application this server uses to talk to banks.",
            content: `<div class="info-row"><span class="info-label">App ID</span><span class="info-value">${escapeHtml(state.appId || "\u2014")}</span></div>
              <div class="info-row"><span class="info-label">Source</span><span class="info-value">${state.credentialsFromEnv ? "Environment" : "Stored in KV"}</span></div>
              <div class="mt-3">${credentialsForm}</div>`,
          })}
          ${state.credentialsFromEnv ? "" : card({
            title: "Danger zone",
            description: "Removing credentials stops all bank access until you add them again.",
            className: "danger-zone",
            footer: `<form action="/api/credentials" method="POST">
                <input type="hidden" name="action" value="delete" />
                <button type="submit" class="btn-destructive btn-sm" onclick="return confirm('Remove stored credentials?')">Remove credentials</button>
              </form>`,
          })}
        </div>
      </details>
    </section>`;

  return page({
    title: "Enable Banking MCP",
    body: `${pageHeader("Enable Banking MCP", "Your banks, and the AI apps that can read them.")}
      ${flash(error, success)}
      ${bankSection}
      <div class="ui-separator section-separator"></div>
      ${clientSection}
      <div class="ui-separator section-separator"></div>
      ${settingsSection}
      <script>
        function toggleRename(id) {
          const f = document.getElementById(id);
          f.classList.toggle('hidden');
          if (!f.classList.contains('hidden')) f.querySelector('input[name=label]').select();
        }
        function copyText(id, btn) {
          const text = document.getElementById(id).textContent;
          navigator.clipboard.writeText(text).then(() => {
            const label = btn.querySelector('span');
            const prev = label.textContent; label.textContent = 'Copied';
            setTimeout(() => { label.textContent = prev; }, 1500);
          });
        }
      </script>`,
  });
}
