# Agent Setup Guide

This guide provides step-by-step instructions for AI coding agents (Claude Code, Cursor, Codex) to deploy this MCP server to a user's Cloudflare account.

## Prerequisites

Before starting, ensure the user has:

1. **Node.js** installed (v18 or later)
2. **Cloudflare account** (free tier works)
3. **Enable Banking account** (create at https://enablebanking.com/cp/)

## Setup

### Step 1: Authenticate with Cloudflare

The user must complete Wrangler authentication:

```bash
npx wrangler login
```

This opens a browser window. The user completes the OAuth flow in their browser. Wait for them to confirm login is complete.

Verify authentication:

```bash
npx wrangler whoami
```

This should display their Cloudflare account email and account ID. If it shows "Not logged in", have the user retry `npx wrangler login`.

### Step 2: Clone the Repository

For easier updates, recommend the user fork the repository first:

```bash
# Option A: Fork via GitHub CLI (recommended)
gh repo fork nowadays-tech/enable-banking-mcp --clone

# Option B: Clone directly (updates require manual remote setup)
git clone https://github.com/nowadays-tech/enable-banking-mcp.git
```

Then install dependencies:

```bash
cd enable-banking-mcp
npm install
```

### Step 3: Create KV Namespaces

First, check for existing namespaces to avoid duplicates:

```bash
npx wrangler kv namespace list
```

If no suitable namespaces exist, create two KV namespaces with **distinct names**:

```bash
npx wrangler kv namespace create enable-banking-mcp-data
npx wrangler kv namespace create enable-banking-mcp-oauth
```

Each command outputs an ID like:

```
🌀 Creating namespace with title "enable-banking-mcp-enable-banking-mcp-data"
✨ Success! Add the following to your wrangler.jsonc:
{ binding = "BANKING_KV", id = "abc123..." }
```

**Important:** Save both namespace IDs. Update `wrangler.jsonc` with the IDs:

```jsonc
"kv_namespaces": [
  { "binding": "BANKING_KV", "id": "YOUR_BANKING_KV_ID" },
  { "binding": "OAUTH_KV", "id": "YOUR_OAUTH_KV_ID" }
]
```

**Note:** Do not commit these IDs to the upstream repository. They are specific to the user's Cloudflare account. Committing them to the user's own fork is fine.

### Step 4: Generate and Set AUTH_SECRET

Generate a strong secret:

```bash
openssl rand -base64 32
```

**Show this value to the user once** and tell them to save it in their password manager. This is their authentication password for:
- Logging into the setup wizard
- OAuth consent for Claude/ChatGPT
- Bearer token for Cursor/CLI tools

Set the secret in Cloudflare:

```bash
npx wrangler secret put AUTH_SECRET
```

Paste the generated secret when prompted. **Never print or log the secret value after showing it once.**

### Step 5: Deploy

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Capture the deployed URL from the output, e.g.:

```
Published enable-banking-mcp (1.0.0)
  https://enable-banking-mcp.YOUR-SUBDOMAIN.workers.dev
```

Save this URL—the user needs it for the next step.

### Step 6: Configure Enable Banking

Guide the user through the Enable Banking Control Panel setup. **Do NOT ask the user to paste their private key into chat.**

1. Direct the user to open https://enablebanking.com/cp/ and sign in (or create an account)

2. Tell the user to click **Create Application** and provide these URLs to enter:
   - **Redirect URL**: `https://YOUR-WORKER-URL/callback`
   - **Privacy URL**: `https://YOUR-WORKER-URL/privacy`
   - **Terms URL**: `https://YOUR-WORKER-URL/terms`

3. Tell the user to:
   - Choose **Sandbox** (test data) or **Production** (real accounts)
   - Click **Generate Key**—a `.pem` file downloads automatically
   - Note their **Application ID** shown after creation

4. Direct the user to the setup wizard:
   ```
   https://YOUR-WORKER-URL/setup
   ```
   
   They will:
   - Log in with their AUTH_SECRET
   - Enter their Application ID
   - Upload their `.pem` file (the wizard validates it)
   - Select their country and bank to connect

The setup wizard at `/setup` handles credential storage securely—the private key is encrypted with AES-256-GCM before storage in KV.

### Step 7: Provide MCP Configuration

After the user completes the setup wizard, give them their MCP server configuration:

**For Claude.ai / ChatGPT (OAuth):**
```
https://YOUR-WORKER-URL/mcp
```
OAuth handles authentication automatically.

**For Cursor / Claude Code (Bearer Token):**
```json
{
  "mcpServers": {
    "banking": {
      "url": "https://YOUR-WORKER-URL/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_SECRET"
      }
    }
  }
}
```

Replace `YOUR_AUTH_SECRET` with the secret the user saved in Step 4.

### Step 8: Verification

Verify the deployment is working:

```bash
# Check the MCP discovery endpoint
curl https://YOUR-WORKER-URL/.well-known/mcp

# Check the privacy page loads
curl -I https://YOUR-WORKER-URL/privacy

# Check the terms page loads
curl -I https://YOUR-WORKER-URL/terms
```

Run the test suite to ensure everything is configured correctly:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

---

## Updating

### Agent-Driven Updates (Manual Deploy)

If the user cloned or forked the repository and deployed via `wrangler deploy`:

```bash
# Add upstream remote if not already added
git remote get-url upstream 2>/dev/null || git remote add upstream https://github.com/nowadays-tech/enable-banking-mcp

# Fetch and merge upstream changes
git fetch upstream
git merge upstream/main
```

When resolving conflicts, **preserve the local KV namespace IDs** in `wrangler.jsonc`. The `id` fields are user-specific and must not be overwritten by upstream changes.

After merging:

```bash
npm install
npm test
npm run typecheck
npm run deploy
```

**Data persistence:** KV namespace data (bank sessions, OAuth tokens, encrypted credentials) and Cloudflare secrets (AUTH_SECRET) persist across deploys.

### Deploy Button Updates

If the user deployed via the "Deploy to Cloudflare" button, the repository was forked to their GitHub account and connected to Cloudflare Workers Builds. Updates deploy automatically when pushed to `main`.

To pull upstream changes:

```bash
# Clone the user's fork
git clone https://github.com/USER/enable-banking-mcp.git
cd enable-banking-mcp

# Add upstream and pull changes
git remote add upstream https://github.com/nowadays-tech/enable-banking-mcp
git pull upstream main --allow-unrelated-histories

# Resolve any conflicts, then push to trigger auto-deploy
git push
```

See the [Updating section in README.md](README.md#updating) for more details.

---

## Troubleshooting

### "KV namespace already exists" or name collision

KV namespace names must be unique within a Cloudflare account. If names collide:

```bash
# List existing namespaces
npx wrangler kv namespace list

# Use existing namespace IDs, or create with different names
npx wrangler kv namespace create my-unique-banking-data
npx wrangler kv namespace create my-unique-oauth-tokens
```

### "Not logged in" or Wrangler authentication errors

Re-authenticate:

```bash
npx wrangler logout
npx wrangler login
npx wrangler whoami
```

### "Failed to load banks" or credential/JWT errors

This usually means Enable Banking credentials are invalid or misconfigured:

1. Verify the Application ID is correct in the setup wizard
2. Re-upload the `.pem` private key file
3. Ensure the `.pem` file is the one downloaded when creating the Enable Banking app
4. Check the Redirect URL in Enable Banking matches `https://YOUR-WORKER-URL/callback` exactly

### "Invalid redirect URL" during bank connection

The Redirect URL in Enable Banking Control Panel must exactly match:
```
https://YOUR-WORKER-URL/callback
```

Check for:
- Trailing slashes (there should be none)
- HTTP vs HTTPS (must be HTTPS)
- Typos in the worker subdomain

### "Bank consent has expired"

Bank consent typically lasts 90-180 days. Visit `/setup` to reconnect the bank account.

### OAuth authorization fails for Claude/ChatGPT

1. Verify AUTH_SECRET is set correctly: `npx wrangler secret list`
2. Try setting AUTH_SECRET again: `npx wrangler secret put AUTH_SECRET`
3. Ensure the MCP client supports OAuth 2.0 with dynamic client registration

### "No bank account connected"

The user needs to complete the setup wizard at `/setup` and connect a bank before using MCP tools.

---

## Available MCP Tools

Once configured, these tools are available:

- **list_accounts** - List all connected bank accounts
- **get_balances** - Get current balance for an account
- **get_transactions** - Retrieve transactions within a date range
- **search_transactions** - Search transactions by text
- **summarize_spending** - Summarize spending by category for a month
