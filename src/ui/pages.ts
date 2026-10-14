import type { BankSession, ASPSP } from "../types";

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

const baseStyles = `
  :root {
    --background: #ffffff;
    --foreground: #09090b;
    --card: #ffffff;
    --card-foreground: #09090b;
    --muted: #f4f4f5;
    --muted-foreground: #71717a;
    --border: #e4e4e7;
    --input: #e4e4e7;
    --primary: #18181b;
    --primary-foreground: #fafafa;
    --secondary: #f4f4f5;
    --secondary-foreground: #18181b;
    --destructive: #ef4444;
    --destructive-foreground: #fafafa;
    --success: #22c55e;
    --success-foreground: #fafafa;
    --ring: #18181b;
    --ring-offset: #ffffff;
    --radius: 0.375rem;
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --card: #18181b;
      --card-foreground: #fafafa;
      --muted: #27272a;
      --muted-foreground: #a1a1aa;
      --border: #27272a;
      --input: #27272a;
      --primary: #fafafa;
      --primary-foreground: #18181b;
      --secondary: #27272a;
      --secondary-foreground: #fafafa;
      --destructive: #dc2626;
      --destructive-foreground: #fafafa;
      --success: #16a34a;
      --success-foreground: #fafafa;
      --ring: #d4d4d8;
      --ring-offset: #09090b;
    }
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--background);
    min-height: 100vh;
    padding: 2rem 1rem;
    color: var(--foreground);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  
  .container {
    max-width: 640px;
    margin: 0 auto;
  }
  
  .page-header {
    margin-bottom: 1.5rem;
  }
  
  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--foreground);
    margin-bottom: 0.25rem;
  }
  
  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--foreground);
    margin-bottom: 0.5rem;
  }
  
  h3 {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
    margin-bottom: 0.5rem;
  }
  
  p {
    color: var(--muted-foreground);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
  
  .subtitle {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
  
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--foreground);
  }
  
  select, input[type="text"], input[type="password"], textarea {
    width: 100%;
    height: 2.5rem;
    padding: 0 0.75rem;
    background: var(--background);
    border: 1px solid var(--input);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--foreground);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  
  textarea {
    height: auto;
    padding: 0.5rem 0.75rem;
  }
  
  select:focus, input:focus, textarea:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 2px var(--ring-offset), 0 0 0 4px color-mix(in srgb, var(--ring) 30%, transparent);
  }
  
  select::placeholder, input::placeholder {
    color: var(--muted-foreground);
  }
  
  .field-group {
    margin-bottom: 1rem;
  }
  
  .section-group {
    margin-bottom: 1.5rem;
  }
  
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.5rem;
    padding: 0 1rem;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s, background-color 0.15s;
  }
  
  button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ring-offset), 0 0 0 4px color-mix(in srgb, var(--ring) 30%, transparent);
  }
  
  button:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-full { width: 100%; }
  
  .btn-secondary {
    background: var(--background);
    color: var(--foreground);
    border: 1px solid var(--border);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--muted);
    opacity: 1;
  }
  
  .btn-destructive {
    background: var(--destructive);
    color: var(--destructive-foreground);
  }
  
  .btn-sm {
    height: 2rem;
    padding: 0 0.75rem;
    font-size: 0.8125rem;
  }
  
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  
  .card h3 {
    margin-bottom: 0.25rem;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid;
  }
  
  .badge-success {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    color: var(--success);
    border-color: color-mix(in srgb, var(--success) 25%, transparent);
  }
  
  .badge-warning {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }
  
  @media (prefers-color-scheme: dark) {
    .badge-warning {
      background: #422006;
      color: #fcd34d;
      border-color: #854d0e;
    }
  }
  
  .badge-error {
    background: color-mix(in srgb, var(--destructive) 10%, transparent);
    color: var(--destructive);
    border-color: color-mix(in srgb, var(--destructive) 25%, transparent);
  }
  
  .badge-muted {
    background: transparent;
    color: var(--muted-foreground);
    border-color: var(--border);
  }
  
  .badge-outline {
    background: transparent;
    color: var(--muted-foreground);
    border-color: var(--border);
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
  }
  
  .info-row:last-child { border-bottom: none; }
  .info-label { color: var(--muted-foreground); }
  .info-value { font-weight: 500; color: var(--foreground); }
  
  .account-list { margin-top: 0.75rem; }
  
  .account-item {
    background: var(--muted);
    border-radius: var(--radius);
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .account-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--foreground);
  }
  
  .account-iban {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    color: var(--muted-foreground);
    font-size: 0.8125rem;
  }
  
  .alert {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.875rem;
    border: 1px solid transparent;
  }
  
  .alert-error {
    background: color-mix(in srgb, var(--destructive) 10%, transparent);
    color: var(--destructive);
    border-color: color-mix(in srgb, var(--destructive) 20%, transparent);
  }
  
  .alert-success {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    color: var(--success);
    border-color: color-mix(in srgb, var(--success) 20%, transparent);
  }
  
  .alert-warning {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }
  
  @media (prefers-color-scheme: dark) {
    .alert-warning {
      background: #422006;
      color: #fcd34d;
      border-color: #854d0e;
    }
  }
  
  .alert-info {
    background: var(--muted);
    color: var(--muted-foreground);
    border-color: var(--border);
  }
  
  .loading {
    text-align: center;
    padding: 1.5rem;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }
  
  .code-block {
    background: var(--muted);
    border: 1px solid var(--border);
    padding: 0.75rem;
    border-radius: var(--radius);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.8125rem;
    word-break: break-all;
    margin: 0.5rem 0;
    position: relative;
    color: var(--foreground);
  }
  
  .code-block code {
    color: var(--foreground);
  }
  
  .copy-wrapper {
    position: relative;
  }
  
  .copy-btn {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    background: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
  }
  
  .copy-btn:hover:not(:disabled) {
    background: var(--muted);
  }
  
  .divider {
    border-top: 1px solid var(--border);
    margin: 1.5rem 0;
  }
  
  /* Command/Combobox style bank list container */
  .banks-container {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-top: 0.5rem;
  }
  
  .banks-list {
    max-height: 240px;
    overflow-y: auto;
  }
  
  .bank-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background-color 0.1s;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
  }
  
  .bank-item:hover {
    background: var(--muted);
  }
  
  .bank-item.selected {
    background: var(--muted);
  }
  
  .bank-item:last-child {
    border-bottom: none;
  }
  
  .bank-item-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .bank-name {
    font-weight: 400;
    font-size: 0.875rem;
    color: var(--foreground);
  }
  
  .bank-item.selected .bank-name {
    font-weight: 500;
  }
  
  .bank-check {
    width: 1rem;
    height: 1rem;
    color: var(--foreground);
    opacity: 0;
    flex-shrink: 0;
  }
  
  .bank-item.selected .bank-check {
    opacity: 1;
  }
  
  .bank-sandbox-badge {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    padding: 0.125rem 0.375rem;
    background: var(--muted);
    border-radius: var(--radius);
  }
  
  .submit-section {
    margin-top: 1rem;
  }
  
  .hidden { display: none; }
  
  .connection-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .connection-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .connection-title {
    font-weight: 500;
    font-size: 0.9375rem;
    color: var(--foreground);
    margin: 0;
  }
  
  .connection-subtitle {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin-top: 0.125rem;
  }
  
  .connection-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin-top: 0.5rem;
  }
  
  .connection-actions {
    display: flex;
    gap: 0.375rem;
  }
  
  .psu-type-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .psu-type-btn {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border);
    background: var(--background);
    border-radius: var(--radius);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }
  
  .psu-type-btn:hover {
    border-color: var(--ring);
  }
  
  .psu-type-btn.selected {
    border-color: var(--foreground);
    background: var(--muted);
  }
  
  .psu-type-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--foreground);
  }
  
  .psu-type-desc {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    margin-top: 0.25rem;
  }
  
  .add-connection-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--muted);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    color: var(--muted-foreground);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .add-connection-btn:hover {
    border-color: var(--ring);
    border-style: solid;
    background: var(--card);
    color: var(--foreground);
  }
  
  /* Step content cards */
  .step-content {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  
  .step-content.active {
    border-color: var(--ring);
  }
  
  .step-content.completed {
    border-color: color-mix(in srgb, var(--success) 50%, transparent);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  
  .step-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  
  .step-number {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 0.6875rem;
    background: var(--muted);
    color: var(--muted-foreground);
    flex-shrink: 0;
  }
  
  .step-content.active .step-number {
    background: var(--foreground);
    color: var(--background);
  }
  
  .step-content.completed .step-number {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }
  
  .instructions-list {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0;
  }
  
  .instructions-list li {
    padding: 0.375rem 0;
    padding-left: 1.25rem;
    position: relative;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }
  
  .instructions-list li::before {
    content: attr(data-step);
    position: absolute;
    left: 0;
    color: var(--foreground);
    font-weight: 500;
  }
  
  .file-upload {
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    text-align: center;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .file-upload:hover {
    border-color: var(--ring);
    background: var(--muted);
  }
  
  .file-upload.has-file {
    border-color: var(--success);
    border-style: solid;
    background: color-mix(in srgb, var(--success) 5%, transparent);
  }
  
  .file-upload input[type="file"] {
    display: none;
  }
  
  .file-upload-icon {
    font-size: 1.5rem;
    margin-bottom: 0.375rem;
    opacity: 0.5;
  }
  
  .file-upload-text {
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }
  
  .file-upload-name {
    color: var(--success);
    font-weight: 500;
    margin-top: 0.375rem;
    font-size: 0.875rem;
  }
  
  .validation-result {
    padding: 0.75rem;
    border-radius: var(--radius);
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
  
  .validation-success {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    color: var(--success);
  }
  
  .validation-error {
    background: color-mix(in srgb, var(--destructive) 10%, transparent);
    color: var(--destructive);
  }
  
  .env-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--muted);
    border-radius: var(--radius);
    color: var(--muted-foreground);
    font-size: 0.8125rem;
    margin-bottom: 0.75rem;
  }
  
  .btn-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  
  .btn-row button {
    flex: 1;
  }
  
  a {
    color: var(--foreground);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  
  a:hover {
    opacity: 0.8;
  }
  
`;

export interface WizardConnection {
  id: string;
  label: string;
  psuType: "personal" | "business";
  aspspName: string;
  aspspCountry: string;
  validUntil: string;
  accountCount: number;
}

export interface WizardState {
  hasCredentials: boolean;
  credentialsFromEnv: boolean;
  appId?: string;
  hasBankSession: boolean;
  bankName?: string;
  accountCount?: number;
  consentExpiry?: string;
  connections?: WizardConnection[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderWizardPage(
  baseUrl: string,
  state: WizardState,
  countries: string[],
  error?: string,
  success?: string
): string {
  const currentStep = !state.hasCredentials ? 1 : !state.hasBankSession ? 2 : 3;
  
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
            <button class="btn-secondary btn-sm" onclick="document.getElementById('credentialsSection').classList.toggle('hidden')">Update Credentials</button>
            <form action="/api/credentials" method="POST" style="flex: 1;">
              <input type="hidden" name="action" value="delete" />
              <button type="submit" class="btn-destructive btn-sm btn-full" onclick="return confirm('Remove stored credentials?')">Remove</button>
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
            validationResult.innerHTML = '<div class="validation-result" style="background: #e2e8f0; color: #718096;">Validating private key...</div>';
            
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
    <div class="step-content ${state.hasBankSession ? 'completed' : state.hasCredentials ? 'active' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasBankSession ? '✓' : '3'}</span>
          <h3>Bank Connections</h3>
        </div>
        ${state.hasBankSession ? `<span class="badge badge-success">${state.connections?.length || 1} Connected</span>` : state.hasCredentials ? '<span class="badge badge-outline">Step 3</span>' : '<span class="badge badge-muted">Pending</span>'}
      </div>
      
      ${state.hasBankSession && state.connections && state.connections.length > 0 ? `
        ${state.connections.map((conn) => {
          const expiryDate = new Date(conn.validUntil);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = daysUntilExpiry <= 0;
          const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 7;
          const statusBadge = isExpired
            ? '<span class="badge badge-error">Expired</span>'
            : isExpiringSoon
              ? '<span class="badge badge-warning">Expiring Soon</span>'
              : '<span class="badge badge-success">Active</span>';
          return `
        <div class="connection-card">
          <div class="connection-header">
            <div>
              <h4 class="connection-title">${escapeHtml(conn.label)}</h4>
              <div class="connection-subtitle">${escapeHtml(conn.aspspName)} · ${conn.psuType === 'business' ? 'Business' : 'Personal'}</div>
            </div>
            <div class="connection-actions">
              ${statusBadge}
            </div>
          </div>
          <div class="connection-meta">
            <span>${conn.accountCount} account${conn.accountCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>${isExpired ? 'Expired' : `Expires ${expiryDate.toLocaleDateString()}`}</span>
          </div>
          <div class="btn-row" style="margin-top: 0.75rem;">
            <form action="/auth/start" method="POST" style="flex: 1;">
              <input type="hidden" name="connection_id" value="${escapeHtml(conn.id)}" />
              <input type="hidden" name="label" value="${escapeHtml(conn.label)}" />
              <input type="hidden" name="psu_type" value="${escapeHtml(conn.psuType)}" />
              <input type="hidden" name="aspsp_id" value="${escapeHtml(conn.aspspName)}" />
              <input type="hidden" name="aspsp_name" value="${escapeHtml(conn.aspspName)}" />
              <input type="hidden" name="country" value="${escapeHtml(conn.aspspCountry)}" />
              <button type="submit" class="btn-secondary btn-sm btn-full">${isExpired ? 'Reconnect' : 'Renew'}</button>
            </form>
            <form action="/disconnect" method="POST" style="flex: 1;">
              <input type="hidden" name="connection_id" value="${escapeHtml(conn.id)}" />
              <button type="submit" class="btn-destructive btn-sm btn-full" onclick="return confirm('Disconnect ${escapeHtml(conn.label)}?')">Disconnect</button>
            </form>
          </div>
        </div>`;
        }).join('')}
        
        <button type="button" class="add-connection-btn" onclick="document.getElementById('addConnectionForm').classList.toggle('hidden')">
          + Add Another Connection
        </button>
      ` : ''}
      
      ${state.hasCredentials ? `
        <div id="addConnectionForm" class="${state.hasBankSession && state.connections && state.connections.length > 0 ? 'hidden' : ''}" style="margin-top: ${state.hasBankSession ? '1rem' : '0'};">
          ${!state.hasBankSession ? '<p>Select your country and bank to connect your account.</p>' : ''}
          
          <form id="bankForm" action="/auth/start" method="POST">
            <div class="field-group">
              <label for="label">Connection Label</label>
              <input type="text" id="label" name="label" placeholder="e.g., Personal, Business, Joint Account" />
              <p style="font-size: 0.75rem; color: var(--muted-foreground); margin-top: 0.25rem;">Give this connection a name to identify it easily</p>
            </div>
            
            <div class="field-group">
              <label>Account Type</label>
              <div class="psu-type-selector">
                <div class="psu-type-btn selected" data-value="personal" onclick="selectPsuType('personal')">
                  <div class="psu-type-label">Personal</div>
                  <div class="psu-type-desc">Individual accounts</div>
                </div>
                <div class="psu-type-btn" data-value="business" onclick="selectPsuType('business')">
                  <div class="psu-type-label">Business</div>
                  <div class="psu-type-desc">Company accounts</div>
                </div>
              </div>
              <input type="hidden" id="psuType" name="psu_type" value="personal" />
            </div>
            
            <div class="field-group">
              <label for="country">Country</label>
              <select id="country" name="country" required>
                <option value="">Select a country...</option>
                ${countries.map((c) => `<option value="${c}">${escapeHtml(getCountryDisplayName(c))}</option>`).join("")}
              </select>
            </div>

            <div id="bankSection" class="hidden section-group">
              <label for="bankSearch">Bank</label>
              <input type="text" id="bankSearch" placeholder="Search banks..." style="margin-bottom: 0;" />
              <div id="psuTypeFilter" class="alert alert-info hidden" style="margin: 0.5rem 0; padding: 0.5rem 0.75rem; font-size: 0.8125rem;"></div>
              <div class="banks-container">
                <div id="banksList" class="banks-list"></div>
              </div>
              <input type="hidden" id="aspspId" name="aspsp_id" required />
              <input type="hidden" id="aspspName" name="aspsp_name" />
            </div>

            <div id="submitSection" class="submit-section hidden">
              <button type="submit" id="connectBankBtn" class="btn-full" disabled>Connect Bank</button>
            </div>
          </form>
        </div>
        
        <script>
          let allBanks = [];
          let filteredBanks = [];
          let selectedBankId = null;
          let selectedPsuType = 'personal';
          
          const countrySelect = document.getElementById('country');
          const bankSection = document.getElementById('bankSection');
          const banksList = document.getElementById('banksList');
          const bankSearch = document.getElementById('bankSearch');
          const aspspIdInput = document.getElementById('aspspId');
          const aspspNameInput = document.getElementById('aspspName');
          const submitSection = document.getElementById('submitSection');
          const connectBankBtn = document.getElementById('connectBankBtn');
          const psuTypeInput = document.getElementById('psuType');
          const psuTypeFilter = document.getElementById('psuTypeFilter');

          function selectPsuType(type) {
            selectedPsuType = type;
            psuTypeInput.value = type;
            document.querySelectorAll('.psu-type-btn').forEach(btn => {
              btn.classList.toggle('selected', btn.dataset.value === type);
            });
            filterAndRenderBanks();
          }

          function updateConnectButton() {
            connectBankBtn.disabled = !selectedBankId;
          }
          
          function filterBanksByPsuType(banks) {
            return banks.filter(b => {
              if (!b.psu_types_supported || b.psu_types_supported.length === 0) {
                return true;
              }
              return b.psu_types_supported.includes(selectedPsuType);
            });
          }
          
          function filterAndRenderBanks() {
            const query = bankSearch.value.toLowerCase();
            let banks = allBanks.filter(b => b.name.toLowerCase().includes(query));
            const beforeFilter = banks.length;
            banks = filterBanksByPsuType(banks);
            const afterFilter = banks.length;
            
            if (beforeFilter > afterFilter && afterFilter > 0) {
              psuTypeFilter.textContent = 'Showing ' + afterFilter + ' of ' + beforeFilter + ' banks that support ' + (selectedPsuType === 'business' ? 'business' : 'personal') + ' accounts';
              psuTypeFilter.classList.remove('hidden');
            } else if (afterFilter === 0 && beforeFilter > 0) {
              psuTypeFilter.textContent = 'No banks support ' + (selectedPsuType === 'business' ? 'business' : 'personal') + ' accounts. Try switching account type.';
              psuTypeFilter.classList.remove('hidden');
            } else {
              psuTypeFilter.classList.add('hidden');
            }
            
            filteredBanks = banks;
            renderBanks(banks);
          }

          countrySelect.addEventListener('change', async () => {
            const country = countrySelect.value;
            selectedBankId = null;
            aspspIdInput.value = '';
            aspspNameInput.value = '';
            updateConnectButton();
            
            if (!country) {
              bankSection.classList.add('hidden');
              submitSection.classList.add('hidden');
              return;
            }

            banksList.innerHTML = '<div class="loading">Loading banks...</div>';
            bankSection.classList.remove('hidden');
            submitSection.classList.remove('hidden');

            try {
              const res = await fetch('/api/banks?country=' + encodeURIComponent(country));
              const data = await res.json();
              if (!res.ok || data.error) {
                banksList.innerHTML = '<div class="alert alert-error" style="margin: 0.5rem;">' + (data.error || 'Failed to load banks: ' + res.status) + '</div>';
                return;
              }
              allBanks = data;
              filterAndRenderBanks();
            } catch (err) {
              banksList.innerHTML = '<div class="alert alert-error" style="margin: 0.5rem;">Failed to load banks: ' + (err.message || 'Network error') + '</div>';
            }
          });

          bankSearch.addEventListener('input', filterAndRenderBanks);

          function renderBanks(banks) {
            if (banks.length === 0) {
              banksList.innerHTML = '<div class="loading">No banks found</div>';
              return;
            }
            banksList.innerHTML = banks.map(b => {
              const bankId = b.aspsp_id || b.name;
              const isSelected = bankId === selectedBankId;
              const psuTypes = b.psu_types_supported || [];
              const supportsBoth = psuTypes.length === 0 || (psuTypes.includes('personal') && psuTypes.includes('business'));
              const psuBadge = supportsBoth ? '' : (psuTypes.includes('business') ? '<span class="bank-sandbox-badge">Business only</span>' : (psuTypes.includes('personal') ? '<span class="bank-sandbox-badge">Personal only</span>' : ''));
              return '<div class="bank-item' + (isSelected ? ' selected' : '') + '" data-id="' + bankId + '" data-name="' + b.name + '">' +
                '<div class="bank-item-content">' +
                  '<span class="bank-name">' + b.name + '</span>' +
                  (b.sandbox ? '<span class="bank-sandbox-badge">Sandbox</span>' : '') +
                  psuBadge +
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
        </script>
      ` : `
        <p>Complete steps 1 and 2 first to connect your bank.</p>
      `}
    </div>

    <!-- Step D: Use with AI -->
    <div class="step-content ${state.hasBankSession ? 'active' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">4</span>
          <h3>Use with AI Assistants</h3>
        </div>
        ${state.hasBankSession ? '<span class="badge badge-success">Ready</span>' : '<span class="badge badge-muted">Pending</span>'}
      </div>
      
      ${state.hasBankSession ? `
        <p>Add this MCP server to your AI assistant:</p>
        
        <div class="card">
          <h3>Claude.ai / ChatGPT (OAuth)</h3>
          <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Add as a custom MCP server - OAuth will handle authentication:</p>
          <div class="copy-wrapper">
            <div class="code-block">
              <code id="mcpUrl">${escapeHtml(baseUrl)}/mcp</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('mcpUrl', this)">Copy</button>
          </div>
        </div>
        
        <div class="card">
          <h3>Cursor / Claude Code (Bearer Token)</h3>
          <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Add to your MCP settings with your AUTH_SECRET as the bearer token:</p>
          <div class="copy-wrapper">
            <div class="code-block" style="font-size: 0.75rem; white-space: pre; overflow-x: auto;">
<code id="cursorConfig">{
  "mcpServers": {
    "banking": {
      "url": "${escapeHtml(baseUrl)}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_SECRET"
      }
    }
  }
}</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('cursorConfig', this)">Copy</button>
          </div>
        </div>
        
        <p style="font-size: 0.875rem; color: #718096;">
          <strong>Available tools:</strong> list_accounts, get_balances, get_transactions, search_transactions, summarize_spending
        </p>
      ` : `
        <p style="color: #a0aec0;">Connect your bank first to get your MCP server URLs.</p>
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

export function renderSetupPage(countries: string[]): string {
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
      <p class="subtitle">Connect your bank account to use with AI assistants</p>
    </div>

    <form id="setupForm" action="/auth/start" method="POST">
      <div class="field-group">
        <label for="country">Country</label>
        <select id="country" name="country" required>
          <option value="">Select a country...</option>
          ${countries.map((c) => `<option value="${c}">${escapeHtml(getCountryDisplayName(c))}</option>`).join("")}
        </select>
      </div>

      <div id="bankSection" class="hidden section-group">
        <label for="bankSearch">Bank</label>
        <input type="text" id="bankSearch" placeholder="Search banks..." style="margin-bottom: 0;" />
        <div class="banks-container">
          <div id="banksList" class="banks-list"></div>
        </div>
        <input type="hidden" id="aspspId" name="aspsp_id" required />
        <input type="hidden" id="aspspName" name="aspsp_name" />
      </div>

      <div id="submitSection" class="submit-section hidden">
        <button type="submit" id="connectBtn" class="btn-full" disabled>Connect Bank</button>
      </div>
    </form>
  </div>

  <script>
    let allBanks = [];
    let selectedBankId = null;
    const countrySelect = document.getElementById('country');
    const bankSection = document.getElementById('bankSection');
    const banksList = document.getElementById('banksList');
    const bankSearch = document.getElementById('bankSearch');
    const aspspIdInput = document.getElementById('aspspId');
    const aspspNameInput = document.getElementById('aspspName');
    const submitSection = document.getElementById('submitSection');
    const connectBtn = document.getElementById('connectBtn');

    function updateConnectButton() {
      connectBtn.disabled = !selectedBankId;
    }

    countrySelect.addEventListener('change', async () => {
      const country = countrySelect.value;
      selectedBankId = null;
      aspspIdInput.value = '';
      aspspNameInput.value = '';
      updateConnectButton();
      
      if (!country) {
        bankSection.classList.add('hidden');
        submitSection.classList.add('hidden');
        return;
      }

      banksList.innerHTML = '<div class="loading">Loading banks...</div>';
      bankSection.classList.remove('hidden');
      submitSection.classList.remove('hidden');

      try {
        const res = await fetch('/api/banks?country=' + encodeURIComponent(country));
        const data = await res.json();
        if (!res.ok || data.error) {
          banksList.innerHTML = '<div class="alert alert-error" style="margin: 0.5rem;">' + (data.error || 'Failed to load banks: ' + res.status) + '</div>';
          return;
        }
        allBanks = data;
        renderBanks(allBanks);
      } catch (err) {
        banksList.innerHTML = '<div class="alert alert-error" style="margin: 0.5rem;">Failed to load banks: ' + (err.message || 'Network error') + '</div>';
      }
    });

    bankSearch.addEventListener('input', () => {
      const query = bankSearch.value.toLowerCase();
      const filtered = allBanks.filter(b => b.name.toLowerCase().includes(query));
      renderBanks(filtered);
    });

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
  </script>
</body>
</html>`;
}

export function renderConnectedPage(
  session: BankSession,
  baseUrl: string
): string {
  const expiryDate = new Date(session.consentValidUntil);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  const statusBadge = isExpired
    ? '<span class="badge badge-error">Expired</span>'
    : isExpiringSoon
      ? '<span class="badge badge-warning">Expiring Soon</span>'
      : '<span class="badge badge-success">Active</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Connected</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header" style="display: flex; align-items: center; gap: 0.75rem;">
      <h1>Bank Connected</h1>
      ${statusBadge}
    </div>
    <p class="subtitle">Your bank account is connected and ready to use</p>

    <div class="card">
      <h3>${session.aspspName}</h3>
      <div class="info-row">
        <span class="info-label">Country</span>
        <span class="info-value">${session.aspspCountry}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Connected Since</span>
        <span class="info-value">${new Date(session.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Consent Expires</span>
        <span class="info-value">${expiryDate.toLocaleDateString()} ${isExpired ? "(Expired)" : `(${daysUntilExpiry} days)`}</span>
      </div>
    </div>

    <h2>Connected Accounts</h2>
    <div class="account-list">
      ${session.accounts
        .map(
          (acc) => `
        <div class="account-item">
          <div class="account-name">${acc.name || "Account"}</div>
          ${acc.iban ? `<div class="account-iban">${acc.iban}</div>` : ""}
          <div style="color: var(--muted-foreground); font-size: 0.8125rem; margin-top: 0.25rem;">
            ${acc.currency || ""} ${acc.accountType ? `· ${acc.accountType}` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="divider"></div>

    <h2>MCP Server URL</h2>
    <p>Add this URL to your AI assistant (Claude, ChatGPT, Cursor, etc.):</p>
    <div class="code-block">
      <code>${baseUrl}/mcp</code>
    </div>
    <p style="font-size: 0.8125rem; color: var(--muted-foreground);">
      Available tools: <strong>list_accounts</strong>, <strong>get_balances</strong>, 
      <strong>get_transactions</strong>, <strong>search_transactions</strong>, 
      <strong>summarize_spending</strong>
    </p>

    <div class="divider"></div>

    <div class="btn-row">
      <form action="/auth/start" method="GET" style="flex: 1;">
        <button type="submit" class="btn-secondary btn-full">
          ${isExpired ? "Reconnect Bank" : "Connect Another Bank"}
        </button>
      </form>
      <form action="/disconnect" method="POST" style="flex: 1;">
        <button type="submit" class="btn-destructive btn-full">Disconnect</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

export function renderCallbackSuccessPage(session: BankSession): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Success</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="alert alert-success">
      <strong>Bank Connected Successfully</strong>
      <p style="margin: 0.25rem 0 0 0;">Your ${session.aspspName} account is now linked.</p>
    </div>

    <p>Found ${session.accounts.length} account(s). You can now use the MCP tools with your AI assistant.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button class="btn-full">View Connected Accounts</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderCallbackErrorPage(error: string, details?: string): string {
  const detailsSection = details ? `
    <details style="margin-top: 1rem; font-size: 0.8125rem;">
      <summary style="cursor: pointer; color: var(--muted-foreground); user-select: none;">
        Show technical details
      </summary>
      <pre style="margin-top: 0.5rem; padding: 0.75rem; background: var(--muted); border-radius: var(--radius); overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 0.75rem; color: var(--muted-foreground);">${escapeHtml(details)}</pre>
    </details>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Error</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="alert alert-error">
      <strong>Connection Failed</strong>
      <p style="margin: 0.25rem 0 0 0;">${escapeHtml(error)}</p>
    </div>

    <p>Please try connecting your bank again. If the problem persists, check that your Enable Banking credentials are configured correctly.</p>
    
    ${detailsSection}

    <a href="/setup" style="display: block; text-decoration: none; margin-top: 1rem;">
      <button class="btn-full">Try Again</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Login</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Login Required</h1>
      <p class="subtitle">Enter your password to access the banking MCP server</p>
    </div>

    ${error ? `<div class="alert alert-error">${error}</div>` : ""}

    <form method="POST">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autofocus />
      <button type="submit" class="btn-full">Login</button>
    </form>

    <p style="font-size: 0.8125rem; margin-top: 1rem; text-align: center; color: var(--muted-foreground);">
      This is your personal banking MCP server. The password is set via the AUTH_SECRET environment variable.
    </p>
  </div>
</body>
</html>`;
}

export function renderDisconnectedPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Disconnected</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="alert alert-success">
      <strong>Bank Disconnected</strong>
      <p style="margin: 0.25rem 0 0 0;">Your bank account has been disconnected.</p>
    </div>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button class="btn-full">Connect a Bank</button>
    </a>
  </div>
</body>
</html>`;
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Error</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>${escapeHtml(title)}</h1>
    </div>

    <div class="alert alert-error">
      <p style="margin: 0;">${escapeHtml(message)}</p>
    </div>

    ${showRetry ? `
    <p>If this problem persists, please check your configuration or try again later.</p>
    <a href="/setup" style="display: inline-block; text-decoration: none; margin-top: 1rem;">
      <button class="btn-secondary">Back to Setup</button>
    </a>
    ` : ''}
  </div>
</body>
</html>`;
}

export function renderConsentPage(
  clientName: string,
  scopes: string[],
  handle: string,
  requirePassword: boolean,
  error?: string
): string {
  const scopeDescriptions: Record<string, string> = {
    "banking:read": "Read your bank accounts, balances, and transactions",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Authorize</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>Authorization Request</h1>
      <p class="subtitle"><strong>${escapeHtml(clientName)}</strong> wants to access your banking data</p>
    </div>

    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}

    <div class="card">
      <h3>Requested Permissions</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${scopes.map((scope) => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem;">
            ${escapeHtml(scopeDescriptions[scope] || scope)}
          </li>
        `).join("")}
      </ul>
    </div>

    <form method="POST">
      <input type="hidden" name="handle" value="${escapeHtml(handle)}" />
      
      ${requirePassword ? `
        <div style="margin-bottom: 1rem;">
          <label for="password">Enter your password to authorize</label>
          <input type="password" id="password" name="password" required autofocus placeholder="Your AUTH_SECRET password" />
        </div>
      ` : `
        <div class="alert alert-success" style="margin-bottom: 1rem;">You are already logged in</div>
      `}

      <div class="btn-row">
        <button type="submit" name="action" value="approve" style="flex: 2;">
          ${requirePassword ? "Authorize" : "Allow Access"}
        </button>
        <button type="submit" name="action" value="deny" class="btn-secondary" style="flex: 1;">
          Deny
        </button>
      </div>
    </form>

    <p style="font-size: 0.75rem; color: var(--muted-foreground); margin-top: 1.5rem; text-align: center;">
      This is your personal banking MCP server. Only authorize clients you trust.
    </p>
  </div>
</body>
</html>`;
}
