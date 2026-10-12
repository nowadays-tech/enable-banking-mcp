import type { BankSession, ASPSP } from "../types";

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
    --radius: 0.5rem;
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
    margin-bottom: 2rem;
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
    margin-bottom: 0.75rem;
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
    margin-bottom: 1rem;
  }
  
  .subtitle {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
  
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
    color: var(--foreground);
  }
  
  select, input[type="text"], input[type="password"], textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--background);
    border: 1px solid var(--input);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--foreground);
    margin-bottom: 1rem;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  
  select:focus, input:focus, textarea:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent);
  }
  
  select::placeholder, input::placeholder {
    color: var(--muted-foreground);
  }
  
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  
  button:hover {
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
  
  .btn-secondary:hover {
    background: var(--muted);
    opacity: 1;
  }
  
  .btn-destructive {
    background: var(--destructive);
    color: var(--destructive-foreground);
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }
  
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .card h3 {
    margin-bottom: 0.25rem;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid transparent;
  }
  
  .badge-success {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
    border-color: color-mix(in srgb, var(--success) 30%, transparent);
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
    background: color-mix(in srgb, var(--destructive) 15%, transparent);
    color: var(--destructive);
    border-color: color-mix(in srgb, var(--destructive) 30%, transparent);
  }
  
  .badge-muted {
    background: var(--muted);
    color: var(--muted-foreground);
    border-color: var(--border);
  }
  
  .badge-active {
    background: var(--primary);
    color: var(--primary-foreground);
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
    padding: 2rem;
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
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
  }
  
  .copy-btn:hover {
    background: var(--muted);
  }
  
  .divider {
    border-top: 1px solid var(--border);
    margin: 1.5rem 0;
  }
  
  .banks-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    max-height: 280px;
    overflow-y: auto;
  }
  
  .bank-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s;
    background: var(--background);
  }
  
  .bank-item:hover {
    background: var(--muted);
  }
  
  .bank-item.selected {
    border-color: var(--ring);
    background: var(--muted);
  }
  
  .bank-name {
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .hidden { display: none; }
  
  /* Step content cards */
  .step-content {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .step-content.active {
    border-color: var(--ring);
  }
  
  .step-content.completed {
    border-color: var(--success);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .step-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .step-number {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 0.75rem;
    background: var(--muted);
    color: var(--muted-foreground);
  }
  
  .step-content.active .step-number {
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .step-content.completed .step-number {
    background: var(--success);
    color: var(--success-foreground);
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
    margin-bottom: 1rem;
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
    margin-top: 0.75rem;
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

export interface WizardState {
  hasCredentials: boolean;
  credentialsFromEnv: boolean;
  appId?: string;
  hasBankSession: boolean;
  bankName?: string;
  accountCount?: number;
  consentExpiry?: string;
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
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-active">Step 1</span>'}
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
        
        <ol class="instructions-list">
          <li data-step="1.">Go to <a href="https://enablebanking.com/cp/" target="_blank" rel="noopener">Enable Banking Control Panel</a> and sign in (or create a free account)</li>
          <li data-step="2.">Click <strong>Create Application</strong></li>
          <li data-step="3.">Enter a name (e.g., "My Banking MCP")</li>
          <li data-step="4.">Choose environment: <strong>Sandbox</strong> (test data) or <strong>Production</strong> (real accounts)</li>
          <li data-step="5.">Paste the redirect URL from above</li>
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
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-active">Step 2</span>'}
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
          <h3>Connect Your Bank</h3>
        </div>
        ${state.hasBankSession ? '<span class="badge badge-success">Connected</span>' : state.hasCredentials ? '<span class="badge badge-active">Step 3</span>' : '<span class="badge badge-muted">Pending</span>'}
      </div>
      
      ${state.hasBankSession ? `
        <div class="card">
          <h3>${escapeHtml(state.bankName || 'Bank')}</h3>
          <div class="info-row">
            <span class="info-label">Accounts</span>
            <span class="info-value">${state.accountCount || 0} connected</span>
          </div>
          <div class="info-row">
            <span class="info-label">Consent Expires</span>
            <span class="info-value">${state.consentExpiry || 'Unknown'}</span>
          </div>
        </div>
        <div class="btn-row">
          <a href="/bank/connect" style="flex: 1; text-decoration: none;">
            <button class="btn-secondary btn-full">Reconnect / Add Bank</button>
          </a>
          <form action="/disconnect" method="POST" style="flex: 1;">
            <button type="submit" class="btn-destructive btn-full" onclick="return confirm('Disconnect your bank account?')">Disconnect</button>
          </form>
        </div>
      ` : state.hasCredentials ? `
        <p>Select your country and bank to connect your account.</p>
        
        <form id="bankForm" action="/auth/start" method="POST">
          <label for="country">Select Country</label>
          <select id="country" name="country" required>
            <option value="">Choose a country...</option>
            ${countries.map((c) => `<option value="${c}">${c}</option>`).join("")}
          </select>

          <div id="bankSection" class="hidden">
            <label>Select Bank</label>
            <input type="text" id="bankSearch" placeholder="Search banks..." />
            <div id="banksList" class="banks-grid"></div>
            <input type="hidden" id="aspspId" name="aspsp_id" required />
            <input type="hidden" id="aspspName" name="aspsp_name" />
          </div>

          <div id="submitSection" class="hidden">
            <button type="submit" class="btn-full">Connect Bank</button>
          </div>
        </form>
        
        <script>
          let allBanks = [];
          const countrySelect = document.getElementById('country');
          const bankSection = document.getElementById('bankSection');
          const banksList = document.getElementById('banksList');
          const bankSearch = document.getElementById('bankSearch');
          const aspspIdInput = document.getElementById('aspspId');
          const aspspNameInput = document.getElementById('aspspName');
          const submitSection = document.getElementById('submitSection');

          countrySelect.addEventListener('change', async () => {
            const country = countrySelect.value;
            if (!country) {
              bankSection.classList.add('hidden');
              return;
            }

            banksList.innerHTML = '<div class="loading">Loading banks...</div>';
            bankSection.classList.remove('hidden');
            submitSection.classList.add('hidden');

            try {
              const res = await fetch('/api/banks?country=' + encodeURIComponent(country));
              const data = await res.json();
              if (!res.ok || data.error) {
                banksList.innerHTML = '<div class="alert alert-error">' + (data.error || 'Failed to load banks: ' + res.status) + '</div>';
                return;
              }
              allBanks = data;
              renderBanks(allBanks);
            } catch (err) {
              banksList.innerHTML = '<div class="alert alert-error">Failed to load banks: ' + (err.message || 'Network error') + '</div>';
            }
          });

          bankSearch.addEventListener('input', () => {
            const query = bankSearch.value.toLowerCase();
            const filtered = allBanks.filter(b => b.name.toLowerCase().includes(query));
            renderBanks(filtered);
          });

          function renderBanks(banks) {
            if (banks.length === 0) {
              banksList.innerHTML = '<p class="loading">No banks found</p>';
              return;
            }
            banksList.innerHTML = banks.map(b => 
              '<div class="bank-item" data-id="' + (b.aspsp_id || b.name) + '" data-name="' + b.name + '">' +
                '<span class="bank-name">' + b.name + (b.sandbox ? ' (Sandbox)' : '') + '</span>' +
              '</div>'
            ).join('');

            document.querySelectorAll('.bank-item').forEach(item => {
              item.addEventListener('click', () => {
                document.querySelectorAll('.bank-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                aspspIdInput.value = item.dataset.id;
                aspspNameInput.value = item.dataset.name;
                submitSection.classList.remove('hidden');
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
      <label for="country">Select Country</label>
      <select id="country" name="country" required>
        <option value="">Choose a country...</option>
        ${countries.map((c) => `<option value="${c}">${c}</option>`).join("")}
      </select>

      <div id="bankSection" class="hidden">
        <label>Select Bank</label>
        <input type="text" id="bankSearch" placeholder="Search banks..." />
        <div id="banksList" class="banks-grid"></div>
        <input type="hidden" id="aspspId" name="aspsp_id" required />
        <input type="hidden" id="aspspName" name="aspsp_name" />
      </div>

      <div id="submitSection" class="hidden">
        <button type="submit" id="connectBtn">Connect Bank</button>
      </div>
    </form>
  </div>

  <script>
    let allBanks = [];
    const countrySelect = document.getElementById('country');
    const bankSection = document.getElementById('bankSection');
    const banksList = document.getElementById('banksList');
    const bankSearch = document.getElementById('bankSearch');
    const aspspIdInput = document.getElementById('aspspId');
    const aspspNameInput = document.getElementById('aspspName');
    const submitSection = document.getElementById('submitSection');

    countrySelect.addEventListener('change', async () => {
      const country = countrySelect.value;
      if (!country) {
        bankSection.classList.add('hidden');
        return;
      }

      banksList.innerHTML = '<div class="loading">Loading banks...</div>';
      bankSection.classList.remove('hidden');
      submitSection.classList.add('hidden');

      try {
        const res = await fetch('/api/banks?country=' + encodeURIComponent(country));
        const data = await res.json();
        if (!res.ok || data.error) {
          banksList.innerHTML = '<div class="alert alert-error">' + (data.error || 'Failed to load banks: ' + res.status) + '</div>';
          return;
        }
        allBanks = data;
        renderBanks(allBanks);
      } catch (err) {
        banksList.innerHTML = '<div class="alert alert-error">Failed to load banks: ' + (err.message || 'Network error') + '</div>';
      }
    });

    bankSearch.addEventListener('input', () => {
      const query = bankSearch.value.toLowerCase();
      const filtered = allBanks.filter(b => b.name.toLowerCase().includes(query));
      renderBanks(filtered);
    });

    function renderBanks(banks) {
      if (banks.length === 0) {
        banksList.innerHTML = '<p class="loading">No banks found</p>';
        return;
      }
      banksList.innerHTML = banks.map(b => 
        '<div class="bank-item" data-id="' + (b.aspsp_id || b.name) + '" data-name="' + b.name + '">' +
          '<span class="bank-name">' + b.name + (b.sandbox ? ' (Sandbox)' : '') + '</span>' +
        '</div>'
      ).join('');

      document.querySelectorAll('.bank-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.bank-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          aspspIdInput.value = item.dataset.id;
          aspspNameInput.value = item.dataset.name;
          submitSection.classList.remove('hidden');
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

export function renderCallbackErrorPage(error: string): string {
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
      <p style="margin: 0.25rem 0 0 0;">${error}</p>
    </div>

    <p>Please try connecting your bank again. If the problem persists, check that your Enable Banking credentials are configured correctly.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
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
