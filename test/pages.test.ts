import { describe, it, expect } from "vitest";
import { renderPrivacyPage, renderTermsPage } from "../src/ui/pages";

describe("Privacy Page", () => {
  it("should render privacy page with hostname", () => {
    const html = renderPrivacyPage("example.workers.dev");

    expect(html).toContain("Privacy Policy");
    expect(html).toContain("example.workers.dev");
    expect(html).toContain("self-hosted, personal MCP server");
  });

  it("should include data handling information", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("Bank connection details");
    expect(html).toContain("Enable Banking credentials");
    expect(html).toContain("Account and transaction data");
  });

  it("should explain data is not shared or sold", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("never shared or sold");
    expect(html).toContain("no analytics");
  });

  it("should explain data storage location", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("Cloudflare KV");
    expect(html).toContain("operator's own Cloudflare account");
  });

  it("should include revocation instructions", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("How to Revoke Access");
    expect(html).toContain("Disconnect");
    expect(html).toContain("Delete the Worker/KV");
  });

  it("should include last updated date", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("Last updated:");
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should mention MIT license", () => {
    const html = renderPrivacyPage("my-banking.workers.dev");

    expect(html).toContain("MIT License");
    expect(html).toContain("open source");
  });

  it("should escape HTML in hostname", () => {
    const html = renderPrivacyPage("<script>alert('xss')</script>");

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("Terms Page", () => {
  it("should render terms page with hostname", () => {
    const html = renderTermsPage("example.workers.dev");

    expect(html).toContain("Terms of Service");
    expect(html).toContain("example.workers.dev");
    expect(html).toContain("self-hosted, personal MCP");
  });

  it("should include no warranty disclaimer", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("WITHOUT WARRANTY OF ANY KIND");
    expect(html).toContain("AS IS");
  });

  it("should include limitation of liability", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("Limitation of Liability");
    expect(html).toContain("at your own risk");
  });

  it("should mention third-party services", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("Enable Banking");
    expect(html).toContain("Cloudflare");
    expect(html).toContain("Third-Party Services");
  });

  it("should link to privacy policy", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy Policy");
  });

  it("should mention MIT license", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("MIT License");
  });

  it("should include last updated date", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("Last updated:");
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should escape HTML in hostname", () => {
    const html = renderTermsPage("<script>alert('xss')</script>");

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should mention personal use intent", () => {
    const html = renderTermsPage("my-banking.workers.dev");

    expect(html).toContain("personal use");
    expect(html).toContain("not a commercial service");
  });
});

describe("Privacy and Terms Pages Styling", () => {
  it("should include base styles in privacy page", () => {
    const html = renderPrivacyPage("test.workers.dev");

    expect(html).toContain("<style>");
    expect(html).toContain(".container");
    expect(html).toContain(".card");
  });

  it("should include base styles in terms page", () => {
    const html = renderTermsPage("test.workers.dev");

    expect(html).toContain("<style>");
    expect(html).toContain(".container");
    expect(html).toContain(".card");
  });

  it("should have proper HTML structure", () => {
    const privacyHtml = renderPrivacyPage("test.workers.dev");
    const termsHtml = renderTermsPage("test.workers.dev");

    for (const html of [privacyHtml, termsHtml]) {
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html lang=\"en\">");
      expect(html).toContain("</html>");
      expect(html).toContain("<head>");
      expect(html).toContain("</head>");
      expect(html).toContain("<body>");
      expect(html).toContain("</body>");
    }
  });

  it("should include back to setup link", () => {
    const privacyHtml = renderPrivacyPage("test.workers.dev");
    const termsHtml = renderTermsPage("test.workers.dev");

    expect(privacyHtml).toContain('href="/setup"');
    expect(termsHtml).toContain('href="/setup"');
    expect(privacyHtml).toContain("Back to Setup");
    expect(termsHtml).toContain("Back to Setup");
  });
});
