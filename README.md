# Enable Banking MCP Server

A personal remote MCP (Model Context Protocol) server that connects your bank accounts to AI assistants like Claude, ChatGPT, and Cursor via the [Enable Banking](https://enablebanking.com/) PSD2 AIS API.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nowadays-tech/enable-banking-mcp)

## Features

- **5 MCP Tools**: `list_accounts`, `get_balances`, `get_transactions`, `search_transactions`, `summarize_spending`
- **32 European Countries**: Supports banks across the EU/EEA via Enable Banking
- **OAuth + Bearer Token Auth**: OAuth for Claude.ai/ChatGPT, Bearer token for Cursor/CLI tools
- **Guided Setup Wizard**: Step-by-step instructions right in the web UI
- **One-Click Deploy**: Deploy to your own Cloudflare account in minutes
- **Privacy-First**: Your data stays in your Cloudflare account, no third-party storage

## What the Deploy Page Asks For

When you click the Deploy to Cloudflare button, you'll be prompted for these values:

| Field | What to Enter |
|-------|---------------|
| **AUTH_SECRET** | A password you choose. Used to log in to the setup page, approve Claude/ChatGPT connections, and as the bearer token for Cursor. Use a long random value and save it in your password manager. |
| **BANKING_KV** | KV namespace for bank connection data. **Give it a unique name**, e.g. `enable-banking-mcp-data`. |
| **OAUTH_KV** | KV namespace for OAuth tokens. **Give it a different name**, e.g. `enable-banking-mcp-oauth`. |

**Important:** The two KV namespaces must have different names. The deploy page may suggest the same name for both—rename them to avoid a collision.

Enable Banking credentials (App ID and private key) are configured after deploy via the setup wizard at your worker URL.

## Quick Start

### 1. Deploy to Cloudflare

Click the **Deploy to Cloudflare Workers** button above. You only need to set one secret:

- **AUTH_SECRET**: A strong password for authentication (used for web UI login, OAuth consent, and API bearer token)

That's it! The Enable Banking credentials are configured through the setup wizard after deployment.

### 2. Complete the Setup Wizard

After deployment, visit your worker URL (e.g., `https://enable-banking-mcp.YOUR-SUBDOMAIN.workers.dev/`):

1. **Log in** with your AUTH_SECRET password
2. **Step A**: Copy your redirect URL and create an Enable Banking app
   - Go to [Enable Banking Control Panel](https://enablebanking.com/cp/) (link opens in new tab)
   - Create a free account if needed
   - Create a new application with your redirect URL
   - Choose **Sandbox** (test data) or **Production** (real accounts)
   - The `.pem` private key downloads automatically when you generate it
3. **Step B**: Enter your App ID and upload the `.pem` file
   - The wizard validates your credentials against the Enable Banking API
4. **Step C**: Select your country and connect your bank
5. **Step D**: Copy your MCP server URLs for Claude.ai, ChatGPT, or Cursor

### 3. Add to Your AI Assistant

The setup wizard (Step D) shows ready-to-copy configurations for each client:

#### Claude.ai / ChatGPT (OAuth)
```
https://YOUR-WORKER.workers.dev/mcp
```
OAuth handles authentication automatically.

#### Cursor / Claude Code (Bearer Token)
```json
{
  "mcpServers": {
    "banking": {
      "url": "https://YOUR-WORKER.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_SECRET"
      }
    }
  }
}
```

## Manual Deployment

For more control, deploy manually:

```bash
# Clone this repository
git clone https://github.com/nowadays-tech/enable-banking-mcp.git
cd enable-banking-mcp

# Install dependencies
npm install

# Create KV namespaces and note the IDs
npx wrangler kv namespace create BANKING_KV
npx wrangler kv namespace create OAUTH_KV
# Copy the IDs from the output and update wrangler.jsonc

# Set the required secret
npx wrangler secret put AUTH_SECRET
# Enter a strong password for authentication

# Deploy
npm run deploy
```

Then visit your worker URL to complete the setup wizard.

## Updating

The **Deploy to Cloudflare** button creates a copy of this repository in your own GitHub account, connected to Cloudflare Workers Builds. Pushes to your copy's `main` branch auto-deploy to your worker.

To pull in updates from this upstream repository:

```bash
# Clone your copy (replace with your GitHub username)
git clone https://github.com/YOUR-USERNAME/enable-banking-mcp.git
cd enable-banking-mcp

# Add upstream remote (only needed once)
git remote add upstream https://github.com/nowadays-tech/enable-banking-mcp

# Pull upstream changes (--allow-unrelated-histories only needed the first time)
git pull upstream main --allow-unrelated-histories

# Resolve any conflicts if prompted, then push to trigger auto-deploy
git push
```

**Your data is preserved across updates:**
- KV namespace data (bank sessions, OAuth tokens)
- Stored Enable Banking credentials (encrypted in KV)
- AUTH_SECRET and any other Cloudflare secrets

### Optional: Set Enable Banking Credentials via Environment

Instead of using the setup wizard, you can set Enable Banking credentials as environment secrets. This is useful for CI/CD or if you prefer not to store encrypted credentials in KV:

```bash
npx wrangler secret put ENABLE_BANKING_APP_ID
npx wrangler secret put ENABLE_BANKING_PRIVATE_KEY
```

When set via environment, these take precedence over wizard-configured credentials.

## MCP Tools

### `list_accounts`
Lists all connected bank accounts with names, IBANs, currencies, and account types.

### `get_balances`
Gets the current balance for a specific account.
- `account_id` (required): The account ID from `list_accounts`

### `get_transactions`
Retrieves transactions within a date range.
- `account_id` (required): The account ID
- `date_from` (optional): Start date (YYYY-MM-DD), defaults to 30 days ago
- `date_to` (optional): End date (YYYY-MM-DD), defaults to today
- `continuation_key` (optional): For paginating large result sets

### `search_transactions`
Search transactions by text in counterparty name or description.
- `account_id` (required): The account ID
- `query` (required): Search text (case-insensitive)
- `date_from` (optional): Start date, defaults to 90 days ago
- `date_to` (optional): End date, defaults to today
- `limit` (optional): Maximum results, defaults to 50

### `summarize_spending`
Summarizes spending by category for a month.
- `account_id` (required): The account ID
- `month` (optional): Month in YYYY-MM format, or "last3" for last 3 months

## Configuration

### Environment Variables (Secrets)

| Secret | Required | Description |
|--------|----------|-------------|
| `AUTH_SECRET` | **Yes** | Password for web UI login, OAuth consent, and bearer token auth |
| `ENABLE_BANKING_APP_ID` | No | Your Enable Banking application ID (can be set via setup wizard) |
| `ENABLE_BANKING_PRIVATE_KEY` | No | RSA private key PEM (can be set via setup wizard) |

When Enable Banking credentials are set via environment variables, they take precedence over credentials configured through the setup wizard.

### KV Namespaces

| Binding | Description |
|---------|-------------|
| `BANKING_KV` | Stores bank sessions, consent data, and encrypted Enable Banking credentials |
| `OAUTH_KV` | Stores OAuth tokens and client registrations |

### Credential Storage Security

When configured via the setup wizard, your Enable Banking private key is:
- Encrypted with AES-256-GCM before storage
- Key derived from your AUTH_SECRET using HKDF
- Never rendered back in the UI
- Stored only in your Cloudflare KV namespace

## Authentication

This server supports two authentication methods:

### OAuth 2.0 (for Claude.ai, ChatGPT)
- Supports dynamic client registration (MCP spec compliant)
- Single-owner consent screen where you enter your `AUTH_SECRET`
- Endpoints: `/authorize`, `/token`, `/register`

### Bearer Token (for Cursor, CLI tools)
- Simple: use your `AUTH_SECRET` as the bearer token
- Header: `Authorization: Bearer YOUR_AUTH_SECRET`

## Limitations & Notes

### Consent Duration
- Bank consent typically lasts **90-180 days** depending on the bank
- You'll need to reconnect when consent expires
- The setup page shows your consent expiry date

### Rate Limits
- Enable Banking has rate limits on API calls
- Avoid making too many rapid requests
- The MCP server handles pagination automatically

### Sandbox vs Production
- **Sandbox**: Test with mock data (free, unlimited)
- **Restricted Production**: Connect your own real accounts (free, limited to your accounts)
- **Full Production**: Requires Enable Banking approval for commercial use

### Security & Privacy

- **Your data stays private**: All data is stored in your own Cloudflare KV namespace
- **OAuth + Bearer auth**: Flexible authentication for different clients
- **No logging**: Transaction data is not logged or stored beyond the session
- **JWT signing**: All Enable Banking API calls are authenticated with your private key
- **HTTPS only**: All connections use TLS encryption

## Development

### Local Environment Setup

1. Copy `.dev.vars.example` to `.dev.vars` and fill in your values:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Run `npm run dev` — wrangler automatically creates local KV storage that persists between runs.

**Optional: Remote KV for `wrangler dev --remote`**

If you need to develop against remote KV namespaces:
```bash
npx wrangler kv namespace create BANKING_KV
npx wrangler kv namespace create OAUTH_KV
# Add the returned IDs to wrangler.jsonc as "id" fields
```

### Commands

```bash
# Install dependencies
npm install

# Generate types
npm run types

# Run locally
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Deploy
npm run deploy
```

### Project Structure

```
├── src/
│   ├── index.ts           # Main worker entry point with OAuth provider
│   ├── types.ts           # TypeScript type definitions
│   ├── enable-banking/
│   │   ├── client.ts      # Enable Banking API client
│   │   └── jwt.ts         # JWT signing utilities
│   ├── mcp/
│   │   └── server.ts      # MCP server with banking tools
│   └── ui/
│       └── pages.ts       # HTML pages for setup UI and OAuth consent
├── test/
│   ├── jwt.test.ts        # JWT signing tests
│   └── tools.test.ts      # Tool handler tests
├── wrangler.jsonc         # Cloudflare Workers configuration
└── package.json
```

## Troubleshooting

### "Invalid or missing bearer token"
Ensure you're sending the `Authorization: Bearer YOUR_AUTH_SECRET` header with MCP requests.

### OAuth authorization fails
Check that:
1. Your `AUTH_SECRET` is set correctly
2. The MCP client supports OAuth 2.0 with dynamic client registration
3. You're entering the correct password on the consent screen

### "Bank consent has expired"
Visit the setup page to reconnect your bank account. Consent typically lasts 90-180 days.

### "Failed to start authorization"
Check that:
1. Your Enable Banking app ID and private key are correct
2. The redirect URL in Enable Banking matches your worker URL
3. Your private key is in PEM format with BEGIN/END lines

### "No bank account connected"
Visit `/setup` to connect a bank account first.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- [Enable Banking](https://enablebanking.com/) - PSD2 AIS API
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol specification
- [@cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider) - OAuth provider library
