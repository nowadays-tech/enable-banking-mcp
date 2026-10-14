/**
 * Shared stylesheet for every server-rendered page, following shadcn/ui
 * conventions: zinc palette tokens, radius 0.5rem, 1px borders, subtle shadow,
 * h-9 controls, text-sm font-medium buttons, and light/dark via prefers-color-scheme.
 *
 * New markup should use the `ui-*` component classes (see components.ts).
 * Older class names used by the setup wizard are mapped onto the same tokens.
 */
export const baseStyles = `
  :root {
    --background: #ffffff;
    --foreground: #09090b;
    --card: #ffffff;
    --card-foreground: #09090b;
    --popover: #ffffff;
    --muted: #f4f4f5;
    --muted-foreground: #71717a;
    --accent: #f4f4f5;
    --accent-foreground: #18181b;
    --border: #e4e4e7;
    --input: #e4e4e7;
    --primary: #18181b;
    --primary-foreground: #fafafa;
    --secondary: #f4f4f5;
    --secondary-foreground: #18181b;
    --destructive: #ef4444;
    --destructive-foreground: #fafafa;
    --success: #16a34a;
    --warning: #b45309;
    --ring: #a1a1aa;
    --radius: 0.5rem;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --check-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fafafa' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
    color-scheme: light;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --card: #09090b;
      --card-foreground: #fafafa;
      --popover: #09090b;
      --muted: #27272a;
      --muted-foreground: #a1a1aa;
      --accent: #27272a;
      --accent-foreground: #fafafa;
      --border: #27272a;
      --input: #27272a;
      --primary: #fafafa;
      --primary-foreground: #18181b;
      --secondary: #27272a;
      --secondary-foreground: #fafafa;
      --destructive: #ef4444;
      --destructive-foreground: #fafafa;
      --success: #22c55e;
      --warning: #f59e0b;
      --ring: #52525b;
      --check-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2318181b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
      color-scheme: dark;
    }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; border-color: var(--border); }

  body {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--background);
    color: var(--foreground);
    min-height: 100vh;
    padding: 3rem 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .container { max-width: 640px; margin: 0 auto; }
  .container-sm { max-width: 28rem; margin: 0 auto; }

  /* Typography */
  .page-header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; letter-spacing: -0.025em; margin-bottom: 0.25rem; }
  h2 { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; margin-bottom: 0.5rem; }
  h3 { font-size: 1rem; font-weight: 600; letter-spacing: -0.015em; line-height: 1.5rem; }
  h4 { font-size: 0.875rem; font-weight: 500; }
  p { color: var(--muted-foreground); font-size: 0.875rem; margin-bottom: 0.5rem; }
  .subtitle, .text-muted { color: var(--muted-foreground); font-size: 0.875rem; }
  .text-xs { font-size: 0.75rem; }
  .text-center { text-align: center; }
  strong { font-weight: 600; color: var(--foreground); }
  code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 0.8125rem; }
  a { color: var(--foreground); text-decoration: underline; text-underline-offset: 4px; }
  a:hover { color: var(--muted-foreground); }

  /* Layout helpers (4px spacing scale) */
  .stack { display: flex; flex-direction: column; gap: 1rem; }
  .stack-sm { display: flex; flex-direction: column; gap: 0.5rem; }
  .row { display: flex; align-items: center; gap: 0.5rem; }
  .row-between { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .mt-2 { margin-top: 0.5rem; } .mt-4 { margin-top: 1rem; } .mt-6 { margin-top: 1.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .w-full { width: 100%; }
  .hidden { display: none !important; }

  /* Card */
  .ui-card, .card, .step-content, .connection-card {
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }
  .ui-card { margin-bottom: 1rem; }
  .ui-card-header { display: flex; flex-direction: column; gap: 0.375rem; padding: 1.5rem; }
  .ui-card-header.with-action { flex-direction: row; align-items: flex-start; justify-content: space-between; }
  .ui-card-title { font-size: 1rem; font-weight: 600; line-height: 1.5rem; letter-spacing: -0.015em; margin: 0; }
  .ui-card-description { color: var(--muted-foreground); font-size: 0.875rem; margin: 0; }
  .ui-card-content { padding: 0 1.5rem 1.5rem; }
  .ui-card-footer { display: flex; align-items: center; gap: 0.5rem; padding: 0 1.5rem 1.5rem; }
  .ui-card-footer > * { flex: 1; }
  .card { padding: 1.5rem; margin-bottom: 1rem; }
  .card h3 { margin-bottom: 0.25rem; }
  .step-content { padding: 1.5rem; margin-bottom: 1rem; }
  .connection-card { padding: 1rem; margin-bottom: 0.75rem; box-shadow: none; }

  /* Separator */
  .ui-separator, .divider { height: 1px; background: var(--border); border: 0; margin: 1rem 0; }

  /* Label + field */
  label, .ui-label { display: block; font-size: 0.875rem; font-weight: 500; line-height: 1; margin-bottom: 0.5rem; color: var(--foreground); }
  .field-group, .ui-field { margin-bottom: 1rem; }
  .ui-field-description { color: var(--muted-foreground); font-size: 0.8125rem; margin-top: 0.375rem; margin-bottom: 0; }
  .section-group { margin-bottom: 1.5rem; }

  /* Input / Select */
  select, input[type="text"], input[type="password"], input[type="email"], textarea, .ui-input {
    display: flex;
    width: 100%;
    height: 2.25rem;
    padding: 0.25rem 0.75rem;
    background: transparent;
    border: 1px solid var(--input);
    border-radius: calc(var(--radius) - 2px);
    box-shadow: var(--shadow-sm);
    font: inherit;
    font-size: 0.875rem;
    color: var(--foreground);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  select { appearance: none; padding-right: 2rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.625rem center; background-size: 1rem; }
  textarea { height: auto; min-height: 4rem; padding: 0.5rem 0.75rem; }
  input::placeholder, textarea::placeholder { color: var(--muted-foreground); }
  select:focus-visible, input:focus-visible, textarea:focus-visible {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent);
  }

  /* Checkbox (shadcn) */
  input[type="checkbox"], .ui-checkbox {
    appearance: none;
    -webkit-appearance: none;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    margin: 0.125rem 0 0;
    border: 1px solid var(--primary);
    border-radius: 4px;
    background: transparent;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    display: inline-grid;
    place-content: center;
  }
  input[type="checkbox"]:checked {
    background: var(--primary) var(--check-icon) center / 0.75rem no-repeat;
    border-color: var(--primary);
  }
  input[type="checkbox"]:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }

  /* Choice list (checkbox rows) */
  .ui-choice-list { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .ui-choice { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 1rem; margin: 0; cursor: pointer; font-weight: 400; line-height: 1.25rem; }
  .ui-choice + .ui-choice { border-top: 1px solid var(--border); }
  .ui-choice:hover { background: color-mix(in srgb, var(--accent) 50%, transparent); }
  .ui-choice-title { font-size: 0.875rem; font-weight: 500; color: var(--foreground); }
  .ui-choice-description { font-size: 0.8125rem; color: var(--muted-foreground); }

  /* Button */
  button, .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.25rem;
    padding: 0 1rem;
    border: 1px solid transparent;
    border-radius: calc(var(--radius) - 2px);
    background: var(--primary);
    color: var(--primary-foreground);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  button svg, .btn svg { width: 1rem; height: 1rem; flex-shrink: 0; }
  button:hover:not(:disabled), .btn:hover { background: color-mix(in srgb, var(--primary) 90%, transparent); color: var(--primary-foreground); }
  button:focus-visible, .btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }
  button:disabled { opacity: 0.5; pointer-events: none; }
  .btn-secondary { background: var(--secondary); color: var(--secondary-foreground); }
  .btn-secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--secondary) 80%, var(--foreground) 4%); color: var(--secondary-foreground); }
  .btn-outline { background: var(--background); color: var(--foreground); border-color: var(--input); }
  .btn-outline:hover:not(:disabled) { background: var(--accent); color: var(--accent-foreground); }
  .btn-ghost { background: transparent; color: var(--foreground); box-shadow: none; }
  .btn-ghost:hover:not(:disabled) { background: var(--accent); color: var(--accent-foreground); }
  .btn-destructive { background: var(--destructive); color: var(--destructive-foreground); }
  .btn-destructive:hover:not(:disabled) { background: color-mix(in srgb, var(--destructive) 90%, transparent); color: var(--destructive-foreground); }
  .btn-sm { height: 2rem; padding: 0 0.75rem; font-size: 0.8125rem; }
  .btn-full { width: 100%; }
  .btn-row { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .btn-row { flex-wrap: wrap; align-items: center; }
  .btn-row form { margin: 0; }
  .add-connection-btn { width: 100%; margin-top: 0.25rem; background: var(--background); color: var(--foreground); border: 1px dashed var(--input); }
  .add-connection-btn:hover:not(:disabled) { background: var(--accent); color: var(--accent-foreground); border-style: solid; }

  /* Alert */
  .ui-alert, .alert {
    position: relative;
    display: grid;
    grid-template-columns: 0 1fr;
    gap: 0.125rem 0;
    align-items: start;
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--card-foreground);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  .ui-alert:has(> svg) { grid-template-columns: 1rem 1fr; column-gap: 0.75rem; }
  .ui-alert > svg { width: 1rem; height: 1rem; margin-top: 0.125rem; color: currentColor; }
  .ui-alert-title { grid-column: 2; font-weight: 500; letter-spacing: -0.01em; }
  .ui-alert-description { grid-column: 2; color: var(--muted-foreground); }
  .ui-alert-description p:last-child { margin-bottom: 0; }
  .alert { display: block; }
  .alert strong { color: inherit; }
  .alert p { margin: 0.25rem 0 0; }
  .ui-alert.destructive, .alert-error { color: var(--destructive); border-color: color-mix(in srgb, var(--destructive) 50%, transparent); }
  .ui-alert.destructive .ui-alert-description, .alert-error p { color: color-mix(in srgb, var(--destructive) 90%, var(--foreground)); }
  .ui-alert.success, .alert-success { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); }
  .ui-alert.success .ui-alert-description, .alert-success p { color: var(--muted-foreground); }
  .ui-alert.warning, .alert-warning { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 40%, transparent); }
  .alert-info { color: var(--foreground); }
  .ui-alert.inline { margin-bottom: 0; background: var(--muted); border-color: transparent; }

  /* Muted status line with icon (e.g. "Signed in") */
  .ui-status { display: flex; align-items: center; gap: 0.5rem; color: var(--muted-foreground); font-size: 0.875rem; }
  .ui-status svg { width: 1rem; height: 1rem; color: var(--success); flex-shrink: 0; }

  /* Badge */
  .badge, .ui-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.625rem;
    border: 1px solid transparent;
    border-radius: calc(var(--radius) - 2px);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    white-space: nowrap;
  }
  .badge-default { background: var(--primary); color: var(--primary-foreground); }
  .badge-secondary, .badge-muted { background: var(--secondary); color: var(--secondary-foreground); }
  .badge-outline { background: transparent; color: var(--foreground); border-color: var(--border); }
  .badge-destructive, .badge-error { background: var(--destructive); color: var(--destructive-foreground); }
  .badge-success { background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); }
  .badge-warning { background: color-mix(in srgb, var(--warning) 12%, transparent); color: var(--warning); border-color: color-mix(in srgb, var(--warning) 30%, transparent); }

  /* Description list rows */
  .info-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.625rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; }
  .info-row:first-child { padding-top: 0; }
  .info-row:last-child { border-bottom: none; padding-bottom: 0; }
  .info-label { color: var(--muted-foreground); }
  .info-value { font-weight: 500; color: var(--foreground); text-align: right; }

  .account-list { margin-top: 0.75rem; }
  .account-item { background: var(--muted); border-radius: calc(var(--radius) - 2px); padding: 0.75rem; margin-bottom: 0.5rem; }
  .account-name { font-weight: 500; font-size: 0.875rem; color: var(--foreground); }
  .account-iban { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; color: var(--muted-foreground); font-size: 0.8125rem; }

  .loading { text-align: center; padding: 1.5rem; color: var(--muted-foreground); font-size: 0.875rem; }

  /* Code + copy */
  .code-block { background: var(--muted); border: 1px solid var(--border); padding: 0.625rem 4.5rem 0.625rem 0.75rem; border-radius: calc(var(--radius) - 2px);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 0.8125rem; word-break: break-all; margin: 0.5rem 0; color: var(--foreground); }
  .code-block.pre { white-space: pre; overflow-x: auto; font-size: 0.75rem; word-break: normal; }
  .copy-wrapper { position: relative; }
  .copy-btn { position: absolute; top: 0.375rem; right: 0.375rem; height: 1.75rem; padding: 0 0.625rem; font-size: 0.75rem;
    background: var(--background); color: var(--foreground); border: 1px solid var(--input); }
  .copy-btn:hover:not(:disabled) { background: var(--accent); color: var(--accent-foreground); }

  /* Command-style bank list */
  .banks-container { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-top: 0.5rem; box-shadow: var(--shadow-sm); }
  .banks-list { max-height: 240px; overflow-y: auto; padding: 0.25rem; }
  .bank-item { display: flex; align-items: center; justify-content: space-between; padding: 0.375rem 0.5rem; border-radius: calc(var(--radius) - 4px); cursor: pointer; }
  .bank-item:hover, .bank-item.selected { background: var(--accent); color: var(--accent-foreground); }
  .bank-item-content { display: flex; align-items: center; gap: 0.5rem; }
  .bank-name { font-size: 0.875rem; color: var(--foreground); }
  .bank-item.selected .bank-name { font-weight: 500; }
  .bank-check { width: 1rem; height: 1rem; color: var(--foreground); opacity: 0; flex-shrink: 0; }
  .bank-item.selected .bank-check { opacity: 1; }
  .bank-sandbox-badge { font-size: 0.75rem; font-weight: 500; color: var(--secondary-foreground); padding: 0 0.375rem; background: var(--secondary); border-radius: calc(var(--radius) - 4px); }
  .submit-section { margin-top: 1rem; }

  /* Connection cards (setup) */
  .connection-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
  .connection-title { font-weight: 500; font-size: 0.875rem; color: var(--foreground); margin: 0; }
  .connection-subtitle { font-size: 0.8125rem; color: var(--muted-foreground); margin-top: 0.125rem; }
  .connection-meta { display: flex; gap: 0.5rem; font-size: 0.8125rem; color: var(--muted-foreground); margin-top: 0.5rem; }
  .connection-actions { display: flex; gap: 0.375rem; }
  .rename-form { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .rename-form input { flex: 1; height: 2rem; }

  /* Segmented account-type picker */
  .psu-type-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .psu-type-btn { padding: 0.75rem; border: 1px solid var(--border); background: var(--background); border-radius: var(--radius); cursor: pointer; text-align: left; transition: border-color 0.15s, background-color 0.15s; }
  .psu-type-btn:hover { background: var(--accent); }
  .psu-type-btn.selected { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
  .psu-type-label { font-weight: 500; font-size: 0.875rem; color: var(--foreground); }
  .psu-type-desc { font-size: 0.75rem; color: var(--muted-foreground); margin-top: 0.125rem; }

  /* Setup steps */
  .step-content.active { border-color: color-mix(in srgb, var(--foreground) 25%, var(--border)); }
  .step-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; }
  .step-title { display: flex; align-items: center; gap: 0.625rem; }
  .step-title h3 { margin: 0; }
  .step-number { width: 1.5rem; height: 1.5rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 0.75rem; background: var(--secondary); color: var(--secondary-foreground); flex-shrink: 0; }
  .step-content.active .step-number { background: var(--primary); color: var(--primary-foreground); }
  .step-content.completed .step-number { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }

  .instructions-list { list-style: none; padding: 0; margin: 0.75rem 0; }
  .instructions-list li { padding: 0.25rem 0 0.25rem 1.5rem; position: relative; color: var(--muted-foreground); font-size: 0.875rem; }
  .instructions-list li::before { content: attr(data-step); position: absolute; left: 0; color: var(--foreground); font-weight: 500; }

  .file-upload { border: 1px dashed var(--input); border-radius: var(--radius); padding: 1.25rem; text-align: center; margin-bottom: 1rem; cursor: pointer; transition: background-color 0.15s; }
  .file-upload:hover { background: var(--accent); }
  .file-upload.has-file { border-style: solid; border-color: var(--success); }
  .file-upload input[type="file"] { display: none; }
  .file-upload-icon { font-size: 1.25rem; margin-bottom: 0.25rem; color: var(--muted-foreground); }
  .file-upload-text { color: var(--muted-foreground); font-size: 0.875rem; }
  .file-upload-name { color: var(--success); font-weight: 500; margin-top: 0.25rem; font-size: 0.875rem; }

  .validation-result { padding: 0.625rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 1rem; font-size: 0.875rem; color: var(--muted-foreground); }
  .validation-success { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); }
  .validation-error { color: var(--destructive); border-color: color-mix(in srgb, var(--destructive) 50%, transparent); }

  .env-notice { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.75rem; background: var(--muted); border-radius: var(--radius); color: var(--muted-foreground); font-size: 0.8125rem; margin-bottom: 0.75rem; }

  .footnote { font-size: 0.75rem; color: var(--muted-foreground); text-align: center; margin-top: 1.5rem; }
  /* Setup overview */
  .section { margin-top: 2rem; }
  .section:first-of-type { margin-top: 1.5rem; }
  .section-separator { margin: 2rem 0 0; }
  .section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
  .section-title { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--foreground); }
  .section-description { font-size: 0.875rem; color: var(--muted-foreground); margin: 0.25rem 0 0; }
  .stack { display: flex; flex-direction: column; gap: 0.75rem; }
  .bank-card .ui-card-footer { display: flex; align-items: center; justify-content: flex-start; gap: 0.5rem; }
  .bank-card .ui-card-footer > *, .danger-zone .ui-card-footer > * { flex: none; }
  .bank-card .ui-card-footer form { margin: 0; }
  .bank-card .ui-card-content { padding-bottom: 1rem; }
  .bank-card .rename-form { margin-top: 0.75rem; }
  .push-right { margin-left: auto !important; }
  .inline-rename { margin-top: 0.5rem; }
  .inline-rename > summary { list-style: none; display: inline-flex; padding-left: 0; margin-left: -0.25rem; }
  .inline-rename > summary::-webkit-details-marker { display: none; }
  .inline-rename[open] > summary { display: none; }
  .inline-rename .rename-form { margin-top: 0; }
  .text-destructive { color: var(--destructive) !important; }
  .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; }
  .mt-3 { margin-top: 0.75rem; }
  .copy-field { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.25rem 0.25rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--muted); margin-bottom: 0.75rem; }
  .copy-field code { flex: 1; font-size: 0.8125rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-x: auto; white-space: nowrap; }
  .copy-field .btn-outline { background: var(--background); gap: 0.375rem; }
  .copy-field svg, .client-icon svg, .ui-collapsible > summary svg { width: 1rem; height: 1rem; }
  .ui-collapsible > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; color: var(--muted-foreground); }
  .ui-collapsible > summary::-webkit-details-marker { display: none; }
  .ui-collapsible > summary:hover { color: var(--foreground); }
  .ui-collapsible[open] > summary svg:first-child { transform: rotate(180deg); }
  .ui-collapsible.settings[open] > summary svg:first-child { transform: none; }
  .ui-collapsible pre { margin-top: 0.75rem; }
  .client-list { list-style: none; margin: 0; padding: 0; }
  .client-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 0; border-top: 1px solid var(--border); }
  .client-row:first-child { border-top: 0; padding-top: 0; }
  .client-row:last-child { padding-bottom: 0; }
  .client-icon { width: 2.25rem; height: 2.25rem; flex: none; display: grid; place-items: center; border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted-foreground); }
  .client-main { flex: 1; min-width: 0; }
  .client-name { font-size: 0.875rem; font-weight: 500; }
  .client-meta { font-size: 0.75rem; color: var(--muted-foreground); }
  .client-banks { margin-top: 0.375rem; display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
  .empty-state { font-size: 0.875rem; color: var(--muted-foreground); text-align: center; padding: 1rem 0; margin: 0; }
  .danger-zone { border-color: color-mix(in srgb, var(--destructive) 40%, var(--border)); }
  .danger-zone .ui-card-title { color: var(--destructive); }
  /* Bank rows + accounts */
  .bank-card { overflow: hidden; }
  .bank-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding: 1rem 1.25rem 0.875rem; }
  .bank-icon { width: 2.25rem; height: 2.25rem; flex: none; display: grid; place-items: center; border-radius: var(--radius); background: var(--muted); color: var(--muted-foreground); }
  .bank-icon svg { width: 1rem; height: 1rem; }
  .bank-main { flex: 1; min-width: 0; }
  .bank-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; font-weight: 600; }
  .bank-meta { font-size: 0.8125rem; color: var(--muted-foreground); margin-top: 0.125rem; }
  .bank-actions { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; flex-basis: 100%; padding-left: 3rem; margin-top: -0.125rem; }
  .bank-actions .push-right { margin-left: auto; }
  .bank-actions form { margin: 0; }
  .bank-rename { padding: 0 1.25rem 1rem; margin: 0 !important; }
  .account-list { list-style: none; margin: 0; padding: 0.25rem 0; background: color-mix(in srgb, var(--muted) 45%, transparent); }
  .account-list li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 1.25rem 0.5rem 4.25rem; font-size: 0.8125rem; }
  .account-list li + li { border-top: 1px solid var(--border); }
  .account-name { color: var(--foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .account-meta { color: var(--muted-foreground); font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 0.8125rem; }
  .bank-card > .empty-state { padding: 0.75rem 1.25rem; text-align: left; }
  @media (max-width: 560px) { .bank-actions { padding-left: 0; } .account-list li { padding-left: 1.25rem; } }
  /* Client access editor */
  .client-item { border-top: 1px solid var(--border); padding: 0.875rem 0; }
  .client-item:first-child { border-top: 0; padding-top: 0; }
  .client-item:last-child { padding-bottom: 0; }
  .client-item .client-row { border: 0; padding: 0; }
  .client-actions { display: flex; align-items: center; gap: 0.25rem; }
  .client-actions form { margin: 0; }
  .scope-editor { margin: 0.875rem 0 0 3rem; padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--background); }
  .scope-editor label { display: flex; align-items: flex-start; gap: 0.625rem; font-size: 0.875rem; cursor: pointer; margin: 0; font-weight: 400; }
  .scope-editor input[type="checkbox"] { margin-top: 0.125rem; }
  .scope-all { padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
  .scope-banks { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.75rem; }
  .scope-banks input:disabled + span, .scope-banks input:disabled ~ span { opacity: 0.55; }
  .scope-accounts { display: flex; flex-direction: column; gap: 0.375rem; margin: 0.5rem 0 0 1.625rem; }
  .scope-account { align-items: center !important; }
  .scope-account .account-meta { margin-left: auto; }
  input[type="checkbox"]:indeterminate { background: var(--primary); border-color: var(--primary); background-image: linear-gradient(var(--primary-foreground), var(--primary-foreground)); background-size: 0.5rem 2px; background-position: center; background-repeat: no-repeat; }
`;
