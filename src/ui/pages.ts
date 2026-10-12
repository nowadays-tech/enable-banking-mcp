import type { BankSession, ASPSP } from "../types";

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 2rem;
    color: #1a202c;
  }
  .container {
    max-width: 700px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    padding: 2rem;
  }
  h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; color: #1a202c; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #4a5568; }
  h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; color: #2d3748; }
  p { color: #718096; margin-bottom: 1rem; line-height: 1.6; }
  .subtitle { font-size: 1rem; color: #718096; margin-bottom: 2rem; }
  label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: #4a5568; }
  select, input[type="text"], input[type="password"], textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1rem;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
  }
  select:focus, input:focus, textarea:focus {
    outline: none;
    border-color: #667eea;
  }
  button {
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5); }
  button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .btn-full { width: 100%; }
  .btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
  }
  .btn-secondary:hover { box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.2); }
  .btn-danger {
    background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
  }
  .btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  .card {
    background: #f7fafc;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid #e2e8f0;
  }
  .card h3 { font-size: 1.125rem; color: #2d3748; margin-bottom: 0.5rem; }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge-success { background: #c6f6d5; color: #276749; }
  .badge-warning { background: #fefcbf; color: #975a16; }
  .badge-error { background: #fed7d7; color: #c53030; }
  .badge-pending { background: #e2e8f0; color: #718096; }
  .badge-active { background: #ebf4ff; color: #4c51bf; }
  .info-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #718096; }
  .info-value { font-weight: 500; color: #2d3748; }
  .account-list { margin-top: 1rem; }
  .account-item {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border: 1px solid #e2e8f0;
  }
  .account-name { font-weight: 600; color: #2d3748; }
  .account-iban { font-family: monospace; color: #718096; font-size: 0.875rem; }
  .error { color: #c53030; background: #fed7d7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .success { color: #276749; background: #c6f6d5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .warning { color: #975a16; background: #fefcbf; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .info { color: #2b6cb0; background: #bee3f8; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .loading { text-align: center; padding: 2rem; color: #718096; }
  .code-block {
    background: #2d3748;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 0.875rem;
    word-break: break-all;
    margin: 0.75rem 0;
    position: relative;
  }
  .code-block code { color: #68d391; }
  .copy-wrapper {
    position: relative;
  }
  .copy-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    background: #4a5568;
    border-radius: 4px;
  }
  .copy-btn:hover { background: #667eea; transform: none; box-shadow: none; }
  .divider { border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  .banks-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; max-height: 300px; overflow-y: auto; }
  .bank-item {
    display: flex;
    align-items: center;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .bank-item:hover { border-color: #667eea; background: #f7fafc; }
  .bank-item.selected { border-color: #667eea; background: #ebf4ff; }
  .bank-name { font-weight: 500; }
  .hidden { display: none; }
  
  /* Wizard Styles */
  .wizard-progress {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2rem;
    padding: 0 1rem;
  }
  .wizard-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    position: relative;
  }
  .wizard-step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 16px;
    left: calc(50% + 20px);
    width: calc(100% - 40px);
    height: 2px;
    background: #e2e8f0;
  }
  .wizard-step.completed:not(:last-child)::after {
    background: #68d391;
  }
  .step-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    position: relative;
    z-index: 1;
    background: #e2e8f0;
    color: #718096;
  }
  .wizard-step.completed .step-circle {
    background: #68d391;
    color: white;
  }
  .wizard-step.active .step-circle {
    background: #667eea;
    color: white;
  }
  .step-label {
    font-size: 0.75rem;
    color: #718096;
    text-align: center;
  }
  .wizard-step.active .step-label {
    color: #667eea;
    font-weight: 600;
  }
  .wizard-step.completed .step-label {
    color: #38a169;
  }
  
  .step-content {
    background: #f7fafc;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 2px solid #e2e8f0;
  }
  .step-content.active {
    border-color: #667eea;
    background: white;
  }
  .step-content.completed {
    border-color: #68d391;
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
    gap: 0.75rem;
  }
  .step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    background: #e2e8f0;
    color: #718096;
  }
  .step-content.active .step-number {
    background: #667eea;
    color: white;
  }
  .step-content.completed .step-number {
    background: #68d391;
    color: white;
  }
  
  .instructions-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }
  .instructions-list li {
    padding: 0.5rem 0;
    padding-left: 1.5rem;
    position: relative;
    color: #4a5568;
  }
  .instructions-list li::before {
    content: attr(data-step);
    position: absolute;
    left: 0;
    color: #667eea;
    font-weight: 600;
  }
  
  .file-upload {
    border: 2px dashed #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    margin-bottom: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .file-upload:hover {
    border-color: #667eea;
    background: #f7fafc;
  }
  .file-upload.has-file {
    border-color: #68d391;
    background: #f0fff4;
  }
  .file-upload input[type="file"] {
    display: none;
  }
  .file-upload-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  .file-upload-text {
    color: #718096;
  }
  .file-upload-name {
    color: #38a169;
    font-weight: 500;
    margin-top: 0.5rem;
  }
  
  .validation-result {
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
  }
  .validation-success {
    background: #c6f6d5;
    color: #276749;
  }
  .validation-error {
    background: #fed7d7;
    color: #c53030;
  }
  
  .env-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #ebf4ff;
    border-radius: 8px;
    color: #4c51bf;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
  
  .btn-row {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  .btn-row button {
    flex: 1;
  }
  
  a { color: #667eea; }
  a:hover { text-decoration: underline; }
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
    <h1>🏦 Enable Banking MCP</h1>
    <p class="subtitle">Connect your bank accounts to AI assistants</p>

    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    ${success ? `<div class="success">${escapeHtml(success)}</div>` : ""}

    <!-- Step A: Get Redirect URL -->
    <div class="step-content ${state.hasCredentials ? 'completed' : 'active'}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasCredentials ? '✓' : 'A'}</span>
          <h3>Create Enable Banking App</h3>
        </div>
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-active">Current</span>'}
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
        
        <div class="info">
          <strong>Sandbox vs Production:</strong> Use Sandbox to test with mock bank data. Use Production to connect your real bank accounts (free for personal use).
        </div>
      ` : `
        <p>Enable Banking application configured.</p>
        ${state.credentialsFromEnv ? `
          <div class="env-notice">
            <span>🔒</span>
            <span>Credentials set via environment secrets (ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY)</span>
          </div>
        ` : `
          <div class="info-row">
            <span class="info-label">App ID</span>
            <span class="info-value">${escapeHtml(state.appId || '')}</span>
          </div>
          <div class="btn-row">
            <button class="btn-secondary btn-small" onclick="document.getElementById('credentialsSection').classList.toggle('hidden')">Update Credentials</button>
            <form action="/api/credentials" method="POST" style="flex: 1;">
              <input type="hidden" name="action" value="delete" />
              <button type="submit" class="btn-danger btn-small btn-full" onclick="return confirm('Remove stored credentials?')">Remove</button>
            </form>
          </div>
        `}
      `}
    </div>

    <!-- Step B: Enter Credentials -->
    <div id="credentialsSection" class="step-content ${!state.hasCredentials ? 'active' : 'completed'} ${state.hasCredentials && !state.credentialsFromEnv ? '' : state.hasCredentials ? 'hidden' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasCredentials ? '✓' : 'B'}</span>
          <h3>Connect Enable Banking</h3>
        </div>
        ${state.hasCredentials ? '<span class="badge badge-success">Complete</span>' : '<span class="badge badge-active">Current</span>'}
      </div>
      
      ${!state.hasCredentials || !state.credentialsFromEnv ? `
        <form id="credentialsForm" action="/api/credentials" method="POST" enctype="multipart/form-data">
          <input type="hidden" name="action" value="save" />
          
          <label for="appId">Application ID</label>
          <input type="text" id="appId" name="appId" placeholder="e.g., abc123def456" required value="${escapeHtml(state.appId || '')}" />
          
          <label>Private Key (.pem file)</label>
          <div class="file-upload" id="fileUpload" onclick="document.getElementById('pemFile').click()">
            <input type="file" id="pemFile" name="pemFile" accept=".pem,.key,.txt" />
            <div class="file-upload-icon">📄</div>
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
                validationResult.innerHTML = '<div class="validation-result validation-success">✓ Private key is valid' + (result.apiTest ? ' and API connection successful!' : '') + '</div>';
              } else {
                validationResult.innerHTML = '<div class="validation-result validation-error">✗ ' + (result.error || 'Invalid private key format') + '</div>';
              }
            } catch (err) {
              validationResult.innerHTML = '<div class="validation-result validation-error">✗ Failed to validate: ' + err.message + '</div>';
            }
          });
        </script>
      ` : ''}
    </div>

    <!-- Step C: Connect Bank -->
    <div class="step-content ${state.hasBankSession ? 'completed' : state.hasCredentials ? 'active' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">${state.hasBankSession ? '✓' : 'C'}</span>
          <h3>Connect Your Bank</h3>
        </div>
        ${state.hasBankSession ? '<span class="badge badge-success">Connected</span>' : state.hasCredentials ? '<span class="badge badge-active">Current</span>' : '<span class="badge badge-pending">Pending</span>'}
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
            <button type="submit" class="btn-danger btn-full" onclick="return confirm('Disconnect your bank account?')">Disconnect</button>
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
              allBanks = await res.json();
              renderBanks(allBanks);
            } catch (err) {
              banksList.innerHTML = '<div class="error">Failed to load banks</div>';
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
        <p style="color: #a0aec0;">Complete steps A and B first to connect your bank.</p>
      `}
    </div>

    <!-- Step D: Use with AI -->
    <div class="step-content ${state.hasBankSession ? 'active' : ''}">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">D</span>
          <h3>Use with AI Assistants</h3>
        </div>
        ${state.hasBankSession ? '<span class="badge badge-success">Ready</span>' : '<span class="badge badge-pending">Pending</span>'}
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
    <h1>🏦 Enable Banking MCP</h1>
    <p class="subtitle">Connect your bank account to use with AI assistants</p>

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
        allBanks = await res.json();
        renderBanks(allBanks);
      } catch (err) {
        banksList.innerHTML = '<div class="error">Failed to load banks</div>';
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
    <h1>🏦 Bank Connected ${statusBadge}</h1>
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
          <div style="color: #718096; font-size: 0.875rem; margin-top: 0.25rem;">
            ${acc.currency || ""} ${acc.accountType ? `• ${acc.accountType}` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="divider"></div>

    <h2>MCP Server URL</h2>
    <p>Add this URL to your AI assistant (Claude, ChatGPT, Cursor, etc.):</p>
    <div class="mcp-url">
      <code>${baseUrl}/mcp</code>
    </div>
    <p style="font-size: 0.875rem;">
      Available tools: <strong>list_accounts</strong>, <strong>get_balances</strong>, 
      <strong>get_transactions</strong>, <strong>search_transactions</strong>, 
      <strong>summarize_spending</strong>
    </p>

    <div class="divider"></div>

    <div style="display: flex; gap: 1rem;">
      <form action="/auth/start" method="GET" style="flex: 1;">
        <button type="submit" class="btn-secondary">
          ${isExpired ? "Reconnect Bank" : "Connect Another Bank"}
        </button>
      </form>
      <form action="/disconnect" method="POST" style="flex: 1;">
        <button type="submit" class="btn-danger">Disconnect</button>
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
    <div class="success">
      <h2 style="color: #276749; margin-bottom: 0.5rem;">✓ Bank Connected Successfully!</h2>
      <p style="margin: 0; color: #276749;">Your ${session.aspspName} account is now linked.</p>
    </div>

    <p>Found ${session.accounts.length} account(s). You can now use the MCP tools with your AI assistant.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>View Connected Accounts</button>
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
    <div class="error">
      <h2 style="margin-bottom: 0.5rem;">Connection Failed</h2>
      <p style="margin: 0;">${error}</p>
    </div>

    <p>Please try connecting your bank again. If the problem persists, check that your Enable Banking credentials are configured correctly.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>Try Again</button>
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
    <h1>🔐 Login Required</h1>
    <p class="subtitle">Enter your password to access the banking MCP server</p>

    ${error ? `<div class="error">${error}</div>` : ""}

    <form method="POST">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autofocus />
      <button type="submit">Login</button>
    </form>

    <p style="font-size: 0.875rem; margin-top: 1rem; text-align: center;">
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
    <div class="success">
      <h2 style="color: #276749; margin-bottom: 0.5rem;">Bank Disconnected</h2>
      <p style="margin: 0; color: #276749;">Your bank account has been disconnected.</p>
    </div>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>Connect a Bank</button>
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
    <h1>🔐 Authorization Request</h1>
    <p class="subtitle"><strong>${escapeHtml(clientName)}</strong> wants to access your banking data</p>

    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}

    <div class="card">
      <h3>Requested Permissions</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${scopes.map((scope) => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
            ✓ ${escapeHtml(scopeDescriptions[scope] || scope)}
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
        <p style="color: #38a169; margin-bottom: 1rem;">✓ You are already logged in</p>
      `}

      <div style="display: flex; gap: 1rem;">
        <button type="submit" name="action" value="approve" style="flex: 2;">
          ${requirePassword ? "Authorize" : "Allow Access"}
        </button>
        <button type="submit" name="action" value="deny" class="btn-secondary" style="flex: 1;">
          Deny
        </button>
      </div>
    </form>

    <p style="font-size: 0.75rem; color: #718096; margin-top: 1.5rem; text-align: center;">
      This is your personal banking MCP server. Only authorize clients you trust.
    </p>
  </div>
</body>
</html>`;
}
