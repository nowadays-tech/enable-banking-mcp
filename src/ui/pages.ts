import { renderSetupOverview } from "./setup-overview";
import type { McpClientView } from "../mcp-clients";
import type { ConnectedSession, ASPSP } from "../types";
import { baseStyles } from "./styles";
import { escapeHtml, alert, flash, badge, consentBadge, card, page, pageHeader, field, icons } from "./components";

export { baseStyles };

const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GR: "Greece",
  HU: "Hungary",
  IS: "Iceland",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
  CH: "Switzerland",
  GB: "United Kingdom",
};

function getCountryDisplayName(code: string): string {
  const name = COUNTRY_NAMES[code];
  return name ? `${name} (${code})` : code;
}


export interface WizardConnection {
  id: string;
  label: string;
  psuType: "personal" | "business";
  aspspName: string;
  aspspCountry: string;
  validUntil: string;
  accountCount: number;
  accounts?: { accountId: string; name?: string; iban?: string; currency?: string }[];
}

export interface WizardState {
  hasCredentials: boolean;
  credentialsFromEnv: boolean;
  appId?: string;
  hasBankSession: boolean;
  connections?: WizardConnection[];
  /** Authorized MCP clients, shown on the overview page once setup is complete. */
  clients?: McpClientView[];
  /** Set by the caller when the OAuth grant listing failed. */
  clientsUnavailable?: boolean;
}


export function renderWizardPage(
  baseUrl: string,
  state: WizardState,
  error?: string,
  success?: string
): string {
  if (state.hasCredentials && state.hasBankSession) {
    return renderSetupOverview(
      baseUrl,
      {
        credentialsFromEnv: state.credentialsFromEnv,
        appId: state.appId,
        connections: state.connections || [],
        clients: state.clientsUnavailable ? undefined : state.clients,
      },
      error,
      success
    );
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Setup</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Enable Banking MCP</h1>
      <p class="subtitle">Connect your bank accounts to AI assistants</p>
    </div>

    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}
    ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ""}

    <!-- Step A: Get Redirect URL -->
    <div class="step-content ${state.hasCredentials ? 'completed' : 'active'}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasCredentials ? '✓' : '1'}</span>
          <h3>Create Enable Banking App</h3>
        </div>
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-outline">Step 1</span>'}
      </div>
      
      ${!state.hasCredentials ? `
        <p>First, create an application in the Enable Banking control panel:</p>
        
        <div class="card">
          <h3>Your Redirect URL</h3>
          <p style="margin-bottom: 0.5rem; font-size: 0.875rem;">Copy this URL and paste it when creating your Enable Banking app:</p>
          <div class="copy-wrapper">
            <div class="code-block">
              <code id="redirectUrl">${escapeHtml(baseUrl)}/callback</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('redirectUrl', this)">Copy</button>
          </div>
        </div>

        <div class="card">
          <h3>Privacy URL (required by Enable Banking)</h3>
          <p style="margin-bottom: 0.5rem; font-size: 0.875rem;">Use this URL for the "Privacy URL of the application" field:</p>
          <div class="copy-wrapper">
            <div class="code-block">
              <code id="privacyUrl">${escapeHtml(baseUrl)}/privacy</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('privacyUrl', this)">Copy</button>
          </div>
        </div>

        <div class="card">
          <h3>Terms URL (required by Enable Banking)</h3>
          <p style="margin-bottom: 0.5rem; font-size: 0.875rem;">Use this URL for the "Terms URL of the application" field:</p>
          <div class="copy-wrapper">
            <div class="code-block">
              <code id="termsUrl">${escapeHtml(baseUrl)}/terms</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('termsUrl', this)">Copy</button>
          </div>
        </div>
        
        <ol class="instructions-list">
          <li data-step="1.">Go to <a href="https://enablebanking.com/cp/" target="_blank" rel="noopener">Enable Banking Control Panel</a> and sign in (or create a free account)</li>
          <li data-step="2.">Click <strong>Create Application</strong></li>
          <li data-step="3.">Enter a name (e.g., "My Banking MCP")</li>
          <li data-step="4.">Choose environment: <strong>Sandbox</strong> (test data) or <strong>Production</strong> (real accounts)</li>
          <li data-step="5.">Paste the <strong>Redirect URL</strong>, <strong>Privacy URL</strong>, and <strong>Terms URL</strong> from above</li>
          <li data-step="6.">Click <strong>Generate Key</strong> - a <code>.pem</code> file will download automatically</li>
          <li data-step="7.">Note your <strong>Application ID</strong> shown after creation</li>
        </ol>
        
        <div class="alert alert-info">
          <strong>Sandbox vs Production:</strong> Use Sandbox to test with mock bank data. Use Production to connect your real bank accounts (free for personal use).
        </div>
      ` : `
        <p>Enable Banking application configured.</p>
        ${state.credentialsFromEnv ? `
          <div class="env-notice">
            <span>Credentials set via environment secrets (ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY)</span>
          </div>
        ` : `
          <div class="info-row">
            <span class="info-label">App ID</span>
            <span class="info-value">${escapeHtml(state.appId || '')}</span>
          </div>
          <div class="btn-row">
            <button class="btn-outline btn-sm" onclick="document.getElementById('credentialsSection').classList.toggle('hidden')">Update Credentials</button>
            <form action="/api/credentials" method="POST">
              <input type="hidden" name="action" value="delete" />
              <button type="submit" class="btn-destructive btn-sm" onclick="return confirm('Remove stored credentials?')">Remove credentials</button>
            </form>
          </div>
        `}
      `}
    </div>

    <!-- Step B: Enter Credentials (only shown when no credentials exist or user clicks Update Credentials) -->
    <div id="credentialsSection" class="step-content ${!state.hasCredentials ? 'active' : 'completed'} ${state.hasCredentials ? 'hidden' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasCredentials ? '✓' : '2'}</span>
          <h3>Connect Enable Banking</h3>
        </div>
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-outline">Step 2</span>'}
      </div>
      
      ${!state.hasCredentials || !state.credentialsFromEnv ? `
        <form id="credentialsForm" action="/api/credentials" method="POST" enctype="multipart/form-data">
          <input type="hidden" name="action" value="save" />
          
          <label for="appId">Application ID</label>
          <input type="text" id="appId" name="appId" placeholder="e.g., abc123def456" required value="${escapeHtml(state.appId || '')}" />
          
          <label>Private Key (.pem file)</label>
          <div class="file-upload" id="fileUpload" onclick="document.getElementById('pemFile').click()">
            <input type="file" id="pemFile" name="pemFile" accept=".pem,.key,.txt" />
            <div class="file-upload-icon">↑</div>
            <div class="file-upload-text">Click to select your .pem file</div>
            <div class="file-upload-name" id="fileName"></div>
          </div>
          <input type="hidden" id="privateKey" name="privateKey" />
          
          <div id="validationResult"></div>
          
          <button type="submit" class="btn-full" id="saveCredentials" disabled>Validate & Save Credentials</button>
        </form>
        
        <script>
          const pemFileInput = document.getElementById('pemFile');
          const privateKeyInput = document.getElementById('privateKey');
          const fileUpload = document.getElementById('fileUpload');
          const fileName = document.getElementById('fileName');
          const saveBtn = document.getElementById('saveCredentials');
          const appIdInput = document.getElementById('appId');
          const validationResult = document.getElementById('validationResult');
          
          function checkFormValid() {
            saveBtn.disabled = !(appIdInput.value.trim() && privateKeyInput.value);
          }
          
          appIdInput.addEventListener('input', checkFormValid);
          
          pemFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            fileName.textContent = file.name;
            fileUpload.classList.add('has-file');
            
            const text = await file.text();
            privateKeyInput.value = text;
            checkFormValid();
            
            // Validate PEM format
            validationResult.innerHTML = '<div class="validation-result">Validating private key...</div>';
            
            try {
              const res = await fetch('/api/credentials/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ privateKey: text, appId: appIdInput.value })
              });
              const result = await res.json();
              
              if (result.valid) {
                validationResult.innerHTML = '<div class="validation-result validation-success">Private key is valid' + (result.apiTest ? ' and API connection successful' : '') + '</div>';
              } else {
                validationResult.innerHTML = '<div class="validation-result validation-error">' + (result.error || 'Invalid private key format') + '</div>';
              }
            } catch (err) {
              validationResult.innerHTML = '<div class="validation-result validation-error">Failed to validate: ' + err.message + '</div>';
            }
          });
        </script>
      ` : ''}
    </div>

    <!-- Step C: Connect Bank -->
    <div class="step-content ${state.hasCredentials ? 'active' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">3</span>
          <h3>Connect a Bank</h3>
        </div>
        ${state.hasCredentials ? '<span class="badge badge-outline">Step 3</span>' : '<span class="badge badge-muted">Pending</span>'}
      </div>
      ${state.hasCredentials ? `
        <p>Pick your bank and approve read access (e.g. with MitID). After that, this page shows your banks and the MCP server URL.</p>
        <form action="/connections/new" method="POST">
          <button type="submit" class="btn-full">${icons.plus} Connect a bank</button>
        </form>
      ` : `
        <p>Complete steps 1 and 2 first to connect your bank.</p>
      `}
    </div>
  </div>

  <script>
    function copyToClipboard(elementId, btn) {
      const el = document.getElementById(elementId);
      const text = el.innerText || el.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

export function renderCallbackSuccessPage(session: ConnectedSession, isRenewal?: boolean, returnTo?: string): string {
  const title = isRenewal ? "Consent renewed" : "Bank connected";
  const message = isRenewal
    ? `Your ${session.aspspName} connection has been renewed.`
    : `Your ${session.aspspName} account is now linked.`;
  if (returnTo === "/setup") returnTo = undefined;
  const footer = returnTo
    ? `<a class="btn" href="${escapeHtml(returnTo)}">Continue authorization ${icons.arrowRight}</a>`
    : `<a class="btn" href="/setup">${isRenewal ? "Back to setup" : "View connections"}</a>`;
  return page({
    title,
    narrow: true,
    body: card({
      title,
      description: message,
      action: badge(`${session.accounts.length} account${session.accounts.length !== 1 ? "s" : ""}`, "success"),
      content: `
        <div class="info-row"><span class="info-label">Bank</span><span class="info-value">${escapeHtml(session.aspspName)}</span></div>
        <div class="info-row"><span class="info-label">Label</span><span class="info-value">${escapeHtml(session.label)}</span></div>
        <div class="info-row"><span class="info-label">Consent valid until</span><span class="info-value">${escapeHtml(new Date(session.consentValidUntil).toLocaleDateString("en-GB"))}</span></div>
        ${returnTo ? `<p class="ui-field-description mt-4">The new connection can now be ticked on the authorization page.</p>` : ""}`,
      footer,
    }),
  });
}

export function renderCallbackErrorPage(error: string, details?: string): string {
  const detailsSection = details
    ? `<details class="mt-4">
        <summary class="text-muted text-xs" style="cursor: pointer;">Show technical details</summary>
        <pre class="code-block pre mt-2">${escapeHtml(details)}</pre>
      </details>`
    : "";
  return page({
    title: "Error",
    narrow: true,
    body: card({
      title: "Something went wrong",
      description: "Please try again. If it keeps failing, check your Enable Banking credentials on the setup page.",
      content: alert({ variant: "destructive", description: error, inline: false }) + detailsSection,
      footer: `<a class="btn" href="/setup">Back to setup</a>`,
    }),
  });
}

export function renderLoginPage(
  error?: string,
  returnUrl?: string,
  opts: { magicLinkEnabled?: boolean; notice?: string } = {}
): string {
  return page({
    title: "Log in",
    narrow: true,
    body: `
    ${flash(error, opts.notice)}
    <form method="POST">
      ${card({
        title: "Log in",
        description: "Enter your password to access your banking MCP server.",
        content: `
          ${returnUrl ? `<input type="hidden" name="return" value="${escapeHtml(returnUrl)}" />` : ""}
          ${field({ id: "password", label: "Password", control: `<input type="password" id="password" name="password" required autofocus autocomplete="current-password" />`, description: "Set via the AUTH_SECRET secret." })}`,
        footer: `<button type="submit" class="btn-full">Log in</button>`,
      })}
      ${opts.magicLinkEnabled ? `
      <button type="submit" name="action" value="magic" formnovalidate class="btn-outline btn-full">${icons.mail} Email me a login link</button>` : ""}
    </form>`,
  });
}

const LAST_UPDATED_DATE = "2026-10-12";

export function renderPrivacyPage(hostname: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Enable Banking MCP</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Privacy Policy</h1>
      <p class="subtitle">How your data is handled by this self-hosted MCP server</p>
    </div>

    <div class="card">
      <h3>Server Operator</h3>
      <p style="margin-bottom: 0;">
        This is a <strong>self-hosted, personal MCP server</strong> deployed at 
        <code>${escapeHtml(hostname)}</code>. 
        The operator is the individual who deployed this Worker to their own Cloudflare account.
      </p>
    </div>

    <div class="card">
      <h3>What Data Is Processed</h3>
      <ul style="list-style: disc; padding-left: 1.5rem; margin: 0;">
        <li style="margin-bottom: 0.5rem;"><strong>Bank connection details</strong>: Session identifiers and consent metadata from Enable Banking</li>
        <li style="margin-bottom: 0.5rem;"><strong>Enable Banking credentials</strong>: Your application ID and private key (encrypted at rest using AES-256-GCM)</li>
        <li style="margin-bottom: 0.5rem;"><strong>Account and transaction data</strong>: Fetched on-demand from your bank via Enable Banking when you or your AI assistant make requests</li>
      </ul>
    </div>

    <div class="card">
      <h3>How Data Is Used</h3>
      <p style="margin-bottom: 0;">
        Your data is used <strong>solely to answer your own AI assistant requests</strong>. 
        When you ask your AI assistant about your bank accounts, balances, or transactions, 
        this server fetches the data from Enable Banking and returns it to your assistant.
      </p>
    </div>

    <div class="card">
      <h3>Where Data Is Stored</h3>
      <p style="margin-bottom: 0;">
        All data is stored exclusively in the operator's own Cloudflare account using Cloudflare KV. 
        <strong>No data is sent to or stored on any third-party servers</strong> beyond Cloudflare 
        (for hosting) and Enable Banking (for bank API access).
      </p>
    </div>

    <div class="card">
      <h3>Data Sharing</h3>
      <p style="margin-bottom: 0;">
        <strong>Your data is never shared or sold.</strong> This is a personal tool for the operator's 
        own use. There is no analytics, tracking, advertising, or data monetization of any kind.
      </p>
    </div>

    <div class="card">
      <h3>How to Revoke Access</h3>
      <p>You can revoke access to your banking data at any time by:</p>
      <ul style="list-style: decimal; padding-left: 1.5rem; margin: 0;">
        <li style="margin-bottom: 0.5rem;"><strong>Disconnect in the UI</strong>: Visit the setup page and click "Disconnect" to remove the bank session</li>
        <li style="margin-bottom: 0.5rem;"><strong>Revoke at your bank</strong>: Most banks allow you to revoke third-party access in your online banking settings</li>
        <li style="margin-bottom: 0.5rem;"><strong>Revoke at Enable Banking</strong>: Contact Enable Banking or use their control panel to revoke consent</li>
        <li style="margin-bottom: 0.5rem;"><strong>Delete the Worker/KV</strong>: Remove the Cloudflare Worker and associated KV namespaces to delete all stored data</li>
      </ul>
    </div>

    <div class="card">
      <h3>Open Source</h3>
      <p style="margin-bottom: 0;">
        This software is open source under the MIT License. You can inspect the code to verify 
        exactly how your data is handled. No data is collected beyond what is described here.
      </p>
    </div>

    <div class="alert alert-info">
      <strong>Last updated:</strong> ${escapeHtml(LAST_UPDATED_DATE)}<br>
      <strong>Server:</strong> ${escapeHtml(hostname)}
    </div>

    <a href="/setup" style="display: inline-block; text-decoration: none; margin-top: 1rem;">
      <button class="btn-secondary">Back to Setup</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderTermsPage(hostname: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Enable Banking MCP</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Terms of Service</h1>
      <p class="subtitle">Terms for using this self-hosted MCP server</p>
    </div>

    <div class="card">
      <h3>Service Description</h3>
      <p style="margin-bottom: 0;">
        This is a <strong>self-hosted, personal MCP (Model Context Protocol) server</strong> 
        deployed at <code>${escapeHtml(hostname)}</code>. It connects your bank accounts 
        to AI assistants via the Enable Banking PSD2 AIS API, allowing you to query your 
        account information, balances, and transactions through your AI assistant.
      </p>
    </div>

    <div class="card">
      <h3>Personal Use</h3>
      <p style="margin-bottom: 0;">
        This server is intended for <strong>personal use by the operator</strong> who deployed it. 
        It is not a commercial service. The operator is responsible for their own use of the 
        Enable Banking API and compliance with their bank's terms of service.
      </p>
    </div>

    <div class="card">
      <h3>No Warranty</h3>
      <p style="margin-bottom: 0;">
        <strong>THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.</strong> 
        This includes, but is not limited to, warranties of merchantability, fitness for a particular 
        purpose, and non-infringement. The entire risk as to the quality and performance of the 
        software is with you.
      </p>
    </div>

    <div class="card">
      <h3>Limitation of Liability</h3>
      <p style="margin-bottom: 0;">
        In no event shall the authors, contributors, or the operator be liable for any claim, 
        damages, or other liability, whether in an action of contract, tort, or otherwise, 
        arising from, out of, or in connection with the software or the use or other dealings 
        in the software. <strong>You use this software at your own risk.</strong>
      </p>
    </div>

    <div class="card">
      <h3>Third-Party Services</h3>
      <p style="margin-bottom: 0;">
        This server relies on third-party services including <strong>Enable Banking</strong> 
        (for bank API access) and <strong>Cloudflare</strong> (for hosting). Your use of 
        these services is subject to their respective terms of service and privacy policies.
      </p>
    </div>

    <div class="card">
      <h3>Data Handling</h3>
      <p style="margin-bottom: 0;">
        Please review the <a href="/privacy">Privacy Policy</a> for information about how your 
        data is collected, used, and stored by this server.
      </p>
    </div>

    <div class="card">
      <h3>Open Source License</h3>
      <p style="margin-bottom: 0;">
        This software is released under the <strong>MIT License</strong>. You are free to use, 
        copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, 
        subject to the conditions of the MIT License.
      </p>
    </div>

    <div class="alert alert-info">
      <strong>Last updated:</strong> ${escapeHtml(LAST_UPDATED_DATE)}<br>
      <strong>Server:</strong> ${escapeHtml(hostname)}
    </div>

    <a href="/setup" style="display: inline-block; text-decoration: none; margin-top: 1rem;">
      <button class="btn-secondary">Back to Setup</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderErrorPage(title: string, message: string, showRetry = true): string {
  return page({
    title,
    narrow: true,
    body: card({
      title,
      description: showRetry ? "If this problem persists, check your configuration or try again later." : undefined,
      content: alert({ variant: "destructive", description: message }),
      footer: showRetry ? `<a class="btn btn-outline" href="/setup">Back to setup</a>` : undefined,
    }),
  });
}

export interface ConsentConnection {
  id: string;
  label: string;
  aspspName: string;
  psuType: "personal" | "business";
  accountCount: number;
  validUntil: string;
}

export interface ConsentPageOptions {
  /** Present once logged in: the bank connections to pick from. */
  connections?: ConsentConnection[];
  /** Pre-ticked connection ids (default: all). */
  selected?: string[];
  magicLinkEnabled?: boolean;
  notice?: string;
}

/**
 * OAuth consent page. Step 1 (requirePassword): log in with the password or an
 * emailed magic link. Step 2: pick which bank connections the client may see,
 * optionally add a new bank, then approve.
 */
export function renderConsentPage(
  clientName: string,
  scopes: string[],
  handle: string,
  requirePassword: boolean,
  error?: string,
  opts: ConsentPageOptions = {}
): string {
  const scopeDescriptions: Record<string, string> = {
    "banking:read": "Read your bank accounts, balances, and transactions",
  };
  const connections = opts.connections || [];
  const selected = opts.selected ? new Set(opts.selected) : null;
  const permissions = scopes
    .map((scope) => `<li class="ui-status" style="color: var(--foreground);">${icons.checkCircle}<span>${escapeHtml(scopeDescriptions[scope] || scope)}</span></li>`)
    .join("");

  const loginCard = card({
    title: "Log in to continue",
    description: "Confirm it's you before granting access.",
    content: field({
      id: "password",
      label: "Password",
      control: `<input type="password" id="password" name="password" autofocus autocomplete="current-password" />`,
      description: "Your AUTH_SECRET.",
    }),
    footer: `<button type="submit" name="action" value="login">Log in</button>
      <button type="submit" name="action" value="deny" class="btn-outline" style="flex: 0 0 auto;">Deny</button>`,
  });

  const choices = connections.length === 0
    ? `<p class="text-muted" style="margin: 0;">No banks connected yet. Add one below, or allow access now and add banks later.</p>`
    : `<div class="ui-choice-list">${connections.map((c) => `
        <label class="ui-choice">
          <input type="checkbox" name="connection" value="${escapeHtml(c.id)}" ${!selected || selected.has(c.id) ? "checked" : ""} />
          <span style="flex: 1;">
            <span class="ui-choice-title">${escapeHtml(c.label)}</span><br />
            <span class="ui-choice-description">${escapeHtml(c.aspspName)} · ${c.psuType === "business" ? "Business" : "Personal"} · ${c.accountCount} account${c.accountCount !== 1 ? "s" : ""}</span>
          </span>
          ${consentBadge(c.validUntil)}
        </label>`).join("")}
      </div>`;

  const pickerCard = card({
    title: "Bank connections",
    description: `Choose which connections ${clientName} can access. Leave all ticked to include banks you add later.`,
    content: `
      <input type="hidden" name="picker" value="1" />
      ${choices}
      <button type="submit" name="action" value="add_bank" formnovalidate class="btn-outline btn-full mt-4">${icons.plus} Add new bank connection</button>`,
    footer: `<button type="submit" name="action" value="approve">Allow access</button>
      <button type="submit" name="action" value="deny" class="btn-outline" style="flex: 0 0 auto;">Deny</button>`,
  });

  return page({
    title: "Authorize",
    narrow: true,
    body: `
    ${pageHeader("Authorization request", `<strong>${escapeHtml(clientName)}</strong> wants to access your banking data.`)}
    ${flash(error, opts.notice)}
    ${card({
      title: "Requested permissions",
      content: `<ul class="stack-sm" style="list-style: none;">${permissions}</ul>
        ${requirePassword ? "" : `<div class="ui-separator"></div><div class="ui-status">${icons.checkCircle}<span>Signed in as the owner</span></div>`}`,
    })}
    <form method="POST">
      <input type="hidden" name="handle" value="${escapeHtml(handle)}" />
      ${requirePassword ? loginCard : pickerCard}
      ${requirePassword && opts.magicLinkEnabled ? `
      <button type="submit" name="action" value="magic" class="btn-outline btn-full">${icons.mail} Email me a login link</button>` : ""}
    </form>
    <p class="footnote">This is your personal banking MCP server. Only authorize clients you trust.</p>`,
  });
}

/** Confirm page for an emailed magic link (POST consumes the one-time token). */
export function renderMagicLinkPage(token: string, valid: boolean): string {
  return page({
    title: valid ? "Log in" : "Link expired",
    narrow: true,
    body: valid
      ? `<form method="POST" action="/auth/magic">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          ${card({
            title: "Log in",
            description: "Continue to your banking MCP server. This link works once.",
            footer: `<button type="submit">Continue ${icons.arrowRight}</button>`,
          })}
        </form>`
      : card({
          title: "Link expired",
          content: alert({ variant: "destructive", description: "This login link has expired or was already used. Request a new one." }),
          footer: `<a class="btn" href="/login">Back to login</a>`,
        }),
  });
}

export function renderConnectPage(
  label: string,
  psuType: "personal" | "business",
  country: string,
  banks: ASPSP[],
  token: string,
  searchQuery?: string,
  opts: { editable?: boolean; countries?: string[]; returnTo?: string } = {}
): string {
  const countryName = getCountryDisplayName(country);
  const editable = Boolean(opts.editable);
  
  const countryOptions = (opts.countries || [country])
    .map((c) => `<option value="${escapeHtml(c)}" ${c === country ? "selected" : ""}>${escapeHtml(getCountryDisplayName(c))}</option>`)
    .join("");

  const detailsContent = editable
    ? `
      ${field({ id: "countrySelect", label: "Country", control: `<select id="countrySelect" onchange="location.href='/connect?token=${encodeURIComponent(token)}&country=' + this.value">${countryOptions}</select>` })}
      ${field({ id: "label", label: "Connection label", control: `<input type="text" id="label" name="label" form="connectForm" maxlength="80" placeholder="e.g. Personal, Holm Friis Holding" />`, description: "Shown in your AI assistant as the connection group." })}
      ${field({ id: "psuTypeSelect", label: "Account type", control: `<select id="psuTypeSelect" name="psu_type" form="connectForm">
          <option value="personal" ${psuType !== "business" ? "selected" : ""}>Personal</option>
          <option value="business" ${psuType === "business" ? "selected" : ""}>Business</option>
        </select>` })}`
    : `
      <div class="info-row"><span class="info-label">Label</span><span class="info-value">${escapeHtml(label)}</span></div>
      <div class="info-row"><span class="info-label">Account type</span><span class="info-value">${psuType === "business" ? "Business" : "Personal"}</span></div>
      <div class="info-row"><span class="info-label">Country</span><span class="info-value">${escapeHtml(countryName)}</span></div>`;

  return page({
    title: "Connect bank",
    narrow: true,
    body: `
    ${pageHeader("Connect bank", editable ? "Add a new bank connection." : `Adding connection <strong>${escapeHtml(label)}</strong>.`)}
    ${card({ title: "Details", content: detailsContent })}
    <form id="connectForm" action="/auth/connect" method="POST">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <input type="hidden" name="country" value="${escapeHtml(country)}" />
      ${editable ? "" : `<input type="hidden" name="psu_type" value="${escapeHtml(psuType)}" />`}
      ${card({
        title: "Select bank",
        description: "You'll be redirected to your bank (e.g. MitID) to approve read access.",
        content: `
          <input type="text" id="bankSearch" aria-label="Search banks" placeholder="Search banks..." value="${escapeHtml(searchQuery || "")}" />
          <div class="banks-container"><div id="banksList" class="banks-list"></div></div>
          <input type="hidden" id="aspspId" name="aspsp_id" required />
          <input type="hidden" id="aspspName" name="aspsp_name" />`,
        footer: `<button type="submit" id="connectBtn" disabled>Connect bank ${icons.arrowRight}</button>
          ${opts.returnTo ? `<a class="btn btn-outline" style="flex: 0 0 auto;" href="${escapeHtml(opts.returnTo)}">Cancel</a>` : ""}`,
      })}
    </form>
  <script>
    const allBanks = ${JSON.stringify(banks.map(b => ({ name: b.name, aspsp_id: b.aspsp_id || b.name, sandbox: b.sandbox })))};
    let selectedBankId = null;
    const banksList = document.getElementById('banksList');
    const bankSearch = document.getElementById('bankSearch');
    const aspspIdInput = document.getElementById('aspspId');
    const aspspNameInput = document.getElementById('aspspName');
    const connectBtn = document.getElementById('connectBtn');

    function updateConnectButton() {
      connectBtn.disabled = !selectedBankId;
    }

    function renderBanks(banks) {
      if (banks.length === 0) {
        banksList.innerHTML = '<div class="loading">No banks found</div>';
        return;
      }
      banksList.innerHTML = banks.map(b => {
        const bankId = b.aspsp_id || b.name;
        const isSelected = bankId === selectedBankId;
        return '<div class="bank-item' + (isSelected ? ' selected' : '') + '" data-id="' + bankId + '" data-name="' + b.name + '">' +
          '<div class="bank-item-content">' +
            '<span class="bank-name">' + b.name + '</span>' +
            (b.sandbox ? '<span class="bank-sandbox-badge">Sandbox</span>' : '') +
          '</div>' +
          '<svg class="bank-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
        '</div>';
      }).join('');

      document.querySelectorAll('.bank-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.bank-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedBankId = item.dataset.id;
          aspspIdInput.value = item.dataset.id;
          aspspNameInput.value = item.dataset.name;
          updateConnectButton();
        });
      });
    }

    bankSearch.addEventListener('input', () => {
      const query = bankSearch.value.toLowerCase();
      const filtered = allBanks.filter(b => b.name.toLowerCase().includes(query));
      renderBanks(filtered);
    });

    // Initial render
    const initialQuery = bankSearch.value.toLowerCase();
    const initialFiltered = initialQuery ? allBanks.filter(b => b.name.toLowerCase().includes(initialQuery)) : allBanks;
    renderBanks(initialFiltered);
  </script>`,
  });
}
