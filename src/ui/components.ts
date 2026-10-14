import { baseStyles } from "./styles";

/** Small shadcn-style building blocks for the server-rendered pages. */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Lucide icons (MIT). */
export const icons = {
  checkCircle: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  alertCircle: svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  mail: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  arrowRight: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  landmark: svg('<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>'),
};

export type AlertVariant = "default" | "destructive" | "success" | "warning";

/** shadcn Alert: icon + title + description. Text is escaped; pass `html` for trusted markup. */
export function alert(opts: {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  html?: string;
  inline?: boolean;
}): string {
  const variant = opts.variant || "default";
  const icon =
    variant === "destructive" ? icons.alertCircle
    : variant === "success" ? icons.checkCircle
    : variant === "warning" ? icons.alertCircle
    : icons.info;
  const cls = ["ui-alert", variant === "default" ? "" : variant, opts.inline ? "inline" : ""].filter(Boolean).join(" ");
  return `<div class="${cls}" role="${variant === "destructive" ? "alert" : "status"}">
      ${icon}
      ${opts.title ? `<div class="ui-alert-title">${escapeHtml(opts.title)}</div>` : ""}
      ${opts.description || opts.html ? `<div class="ui-alert-description">${opts.html ?? escapeHtml(opts.description!)}</div>` : ""}
    </div>`;
}

/** Standard error/notice alerts shown at the top of a page. */
export function flash(error?: string, notice?: string): string {
  return [
    error ? alert({ variant: "destructive", title: "Error", description: error }) : "",
    notice ? alert({ variant: "success", description: notice }) : "",
  ].join("");
}

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success" | "warning";

export function badge(text: string, variant: BadgeVariant = "secondary"): string {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`;
}

/** Status badge for a consent expiry: Active / Expiring soon / Expired. */
export function consentBadge(validUntil: string, now = new Date()): string {
  const days = Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86400000);
  if (days <= 0) return badge("Expired", "destructive");
  if (days <= 14) return badge(`Expires in ${days}d`, "warning");
  return badge("Active", "success");
}

/** shadcn Card with optional header, footer and header action (e.g. a badge). */
export function card(opts: {
  title?: string;
  description?: string;
  action?: string;
  content?: string;
  footer?: string;
  id?: string;
  className?: string;
}): string {
  const header =
    opts.title || opts.description
      ? `<div class="ui-card-header${opts.action ? " with-action" : ""}">
          ${opts.action ? "<div>" : ""}
          ${opts.title ? `<h3 class="ui-card-title">${escapeHtml(opts.title)}</h3>` : ""}
          ${opts.description ? `<p class="ui-card-description">${escapeHtml(opts.description)}</p>` : ""}
          ${opts.action ? `</div>${opts.action}` : ""}
        </div>`
      : "";
  const content = opts.content
    ? `<div class="ui-card-content"${header ? "" : ' style="padding-top: 1.5rem;"'}>${opts.content}</div>`
    : "";
  const footer = opts.footer ? `<div class="ui-card-footer">${opts.footer}</div>` : "";
  return `<div class="ui-card${opts.className ? " " + opts.className : ""}"${opts.id ? ` id="${opts.id}"` : ""}>${header}${content}${footer}</div>`;
}

/** Full HTML document with the shared stylesheet. */
export function page(opts: { title: string; body: string; narrow?: boolean; head?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(opts.title)} · Enable Banking MCP</title>
  <style>${baseStyles}</style>
  ${opts.head || ""}
</head>
<body>
  <main class="${opts.narrow ? "container-sm" : "container"}">
${opts.body}
  </main>
</body>
</html>`;
}

export function pageHeader(title: string, subtitle?: string): string {
  return `<div class="page-header">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
    </div>`;
}

/** Label above an input, with optional description. `control` is trusted HTML. */
export function field(opts: { id?: string; label: string; control: string; description?: string }): string {
  return `<div class="ui-field">
      <label class="ui-label"${opts.id ? ` for="${opts.id}"` : ""}>${escapeHtml(opts.label)}</label>
      ${opts.control}
      ${opts.description ? `<p class="ui-field-description">${escapeHtml(opts.description)}</p>` : ""}
    </div>`;
}

export const separator = `<div class="ui-separator" role="separator"></div>`;
