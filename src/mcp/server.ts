import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Env, BankSession, BankAccount, Transaction, ConnectionStatusInfo } from "../types";
import { resolveScope, filterByScope, inScope, type TokenProps, type AccessScope } from "../scope";
import {
  EnableBankingClient,
  isConsentExpired,
  getAllSessions,
  findConnectionByAccountId,
  getConnectionIndex,
  buildConnectionInfo,
  buildExpiryWarning,
  getBaseUrl,
  isExpiredSessionError,
  storeConnectRequest,
} from "../enable-banking/client";

function renewUrlFor(baseUrl: string, connectionId: string): string {
  return `${baseUrl}/renew/${encodeURIComponent(connectionId)}`;
}

async function expiredMessage(env: Env, label: string, connectionId: string): Promise<string> {
  const baseUrl = await getBaseUrl(env.BANKING_KV);
  if (baseUrl) {
    return `Connection '${label}' has expired. Renew here: ${renewUrlFor(baseUrl, connectionId)}`;
  }
  return `Bank consent for "${label}" has expired. Please reconnect by visiting the setup page at /setup`;
}

async function getExpiryWarning(env: Env, scope: AccessScope): Promise<string | null> {
  const baseUrl = await getBaseUrl(env.BANKING_KV);
  if (!baseUrl) return null;
  const sessions = filterByScope(scope, await getAllSessions(env.BANKING_KV));
  const index = await getConnectionIndex(env.BANKING_KV);
  return buildExpiryWarning(withLabels(sessions, index), baseUrl);
}

type LabelledSession = BankSession & { connectionId: string; label: string };

/** All sessions visible to this token, with resolved labels. */
async function scopedSessions(env: Env, scope: AccessScope): Promise<LabelledSession[]> {
  const sessions = filterByScope(scope, await getAllSessions(env.BANKING_KV));
  const index = await getConnectionIndex(env.BANKING_KV);
  return withLabels(sessions, index) as LabelledSession[];
}

export interface AccountTarget {
  connectionId: string;
  label: string;
  session: LabelledSession;
  account: BankAccount;
}

/**
 * Resolve which accounts a data tool should read, within the token's scope.
 * `group` matches a connection label (case-insensitive) or connection id.
 * Without account_id, every account of every non-expired matching connection is used.
 */
export async function resolveTargets(
  env: Env,
  scope: AccessScope,
  filter: { account_id?: string; group?: string }
): Promise<{ targets: AccountTarget[]; error?: string; skippedExpired: string[] }> {
  const all = await scopedSessions(env, scope);
  if (all.length === 0) {
    return { targets: [], skippedExpired: [], error: "No bank account connected. Please visit /setup to connect your bank." };
  }
  let sessions = all;
  if (filter.group) {
    const g = filter.group.toLowerCase();
    sessions = all.filter((s) => s.label.toLowerCase() === g || s.connectionId.toLowerCase() === g);
    if (sessions.length === 0) {
      return {
        targets: [], skippedExpired: [],
        error: `No connection found with group "${filter.group}". Use list_connections to see available connections.`,
      };
    }
  }
  if (filter.account_id) {
    for (const session of sessions) {
      const account = session.accounts.find((a) => a.accountId === filter.account_id);
      if (!account) continue;
      if (isConsentExpired(session)) {
        return { targets: [], skippedExpired: [], error: await expiredMessage(env, session.label, session.connectionId) };
      }
      return { targets: [{ connectionId: session.connectionId, label: session.label, session, account }], skippedExpired: [] };
    }
    return {
      targets: [], skippedExpired: [],
      error: `Account ${filter.account_id} not found. Use list_accounts to see available accounts.`,
    };
  }
  const targets: AccountTarget[] = [];
  const skippedExpired: string[] = [];
  for (const session of sessions) {
    if (isConsentExpired(session)) {
      skippedExpired.push(session.label);
      continue;
    }
    for (const account of session.accounts) {
      targets.push({ connectionId: session.connectionId, label: session.label, session, account });
    }
  }
  if (targets.length === 0 && skippedExpired.length > 0) {
    const first = sessions.find((s) => isConsentExpired(s))!;
    return { targets, skippedExpired, error: await expiredMessage(env, first.label, first.connectionId) };
  }
  return { targets, skippedExpired };
}

function withLabels<T extends BankSession & { connectionId: string }>(
  sessions: T[],
  index: Awaited<ReturnType<typeof getConnectionIndex>>
): T[] {
  return sessions.map((s) => {
    const info = index?.connections.find((c) => c.id === s.connectionId);
    return {
      ...s,
      label: info?.label || s.label || (s.connectionId === "default" ? "Default" : s.aspspName),
      psuType: info?.psuType || s.psuType,
    };
  });
}

export function appendExpiryWarning(result: string, warning: string | null): string {
  if (!warning) return result;
  return `${result}\n\n---\n${warning}`;
}

function formatAmount(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

function categorizeTransaction(tx: Transaction): string {
  const mcc = tx.merchant_category_code;
  const info = (tx.remittance_information || []).join(" ").toLowerCase();
  const creditor = (tx.creditor_name || "").toLowerCase();

  if (mcc) {
    const mccNum = parseInt(mcc);
    if (mccNum >= 5411 && mccNum <= 5499) return "Groceries";
    if (mccNum >= 5812 && mccNum <= 5814) return "Restaurants";
    if (mccNum >= 4011 && mccNum <= 4789) return "Transportation";
    if (mccNum >= 5200 && mccNum <= 5261) return "Home";
    if (mccNum >= 5300 && mccNum <= 5399) return "Shopping";
    if (mccNum >= 6011 && mccNum <= 6399) return "Financial";
    if (mccNum >= 7800 && mccNum <= 7999) return "Entertainment";
    if (mccNum >= 8011 && mccNum <= 8099) return "Healthcare";
  }

  const keywords: Record<string, string[]> = {
    Groceries: ["grocery", "supermarket", "food", "market"],
    Restaurants: ["restaurant", "cafe", "coffee", "pizza", "burger"],
    Transportation: ["uber", "lyft", "taxi", "transit", "fuel", "gas", "parking"],
    Utilities: ["electric", "water", "gas", "internet", "phone"],
    Entertainment: ["netflix", "spotify", "cinema", "movie", "game"],
    Shopping: ["amazon", "ebay", "shop", "store"],
    Healthcare: ["pharmacy", "doctor", "hospital", "medical"],
    Subscription: ["subscription", "membership"],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => info.includes(w) || creditor.includes(w))) {
      return category;
    }
  }

  return "Other";
}

function textContent(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

const filterSchema = {
  group: z
    .string()
    .optional()
    .describe("Only use this connection group (label such as 'Personal' or 'Holm Friis Holding', or connection id)"),
};

const accountIdSchema = z
  .string()
  .optional()
  .describe("Account ID (from list_accounts). Omit to use all accounts (within the group filter, if given)");

function accountName(t: AccountTarget): string {
  return t.account.name || t.account.iban || t.account.accountId;
}

function withSkipped<T extends object>(body: T, skippedExpired: string[]): T {
  return skippedExpired.length > 0
    ? { ...body, skippedExpiredConnections: skippedExpired }
    : body;
}

/**
 * @param props OAuth token props. Absent (AUTH_SECRET bearer) or without
 * scopeGroups means the token can see all connections.
 */
export function createBankingMcpServer(env: Env, props?: TokenProps | null) {
  const server = new McpServer({
    name: "enable-banking-mcp",
    version: "1.0.0",
  });

  const getScope = () => resolveScope(env.BANKING_KV, props);

  // Map bank "expired/invalid session" API errors to a clear renew message.
  const originalRegisterTool = server.registerTool.bind(server) as (...args: any[]) => any;
  (server as any).registerTool = (name: string, config: unknown, handler: (args: any, extra: any) => any) =>
    originalRegisterTool(name, config, async (args: any, extra: any) => {
      try {
        return await handler(args, extra);
      } catch (error) {
        if (!isExpiredSessionError(error)) throw error;
        const accountId = args?.account_id as string | undefined;
        const found = accountId ? await findConnectionByAccountId(env.BANKING_KV, accountId) : null;
        const connectionId = found?.connectionId || "default";
        const index = await getConnectionIndex(env.BANKING_KV);
        const info = index?.connections.find((c) => c.id === connectionId);
        const label =
          info?.label || found?.session.label || (connectionId === "default" ? "Default" : connectionId);
        return textContent(await expiredMessage(env, label, connectionId));
      }
    });

  const ok = async (text: string, scope: AccessScope) =>
    textContent(appendExpiryWarning(text, await getExpiryWarning(env, scope)));

  const connectionInfos = async (): Promise<ConnectionStatusInfo[] | string> => {
    const baseUrl = await getBaseUrl(env.BANKING_KV);
    if (!baseUrl) return "Base URL not configured. Please visit the setup page first.";
    const sessions = await scopedSessions(env, await getScope());
    if (sessions.length === 0) {
      return "No bank connections found. Use add_bank_connection or visit /setup to connect a bank.";
    }
    return sessions.map((session) => buildConnectionInfo(session, baseUrl));
  };

  server.registerTool(
    "list_connections",
    {
      description:
        "List the bank connections this client can access: id, label (group), bank, account type (personal/business), consent expiry, days left, status, account count and renewal link. Use the label or id as the 'group' filter in other tools. To add a bank, use add_bank_connection.",
      inputSchema: {},
    },
    async () => {
      const infos = await connectionInfos();
      if (typeof infos === "string") return textContent(infos);
      return textContent(
        JSON.stringify(
          {
            connections: infos.map((c) => ({
              id: c.connectionId,
              label: c.label,
              bank: c.bank,
              country: c.country,
              psuType: c.psuType,
              expiresAt: c.validUntil,
              daysLeft: c.daysLeft,
              status: c.status,
              accountCount: c.accountCount,
              renewUrl: c.renewUrl,
            })),
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "connection_status",
    {
      description:
        "List bank connections with their consent status (ok, expiring, expired), expiry date, days left, and a renewal link. Use this to check which connections need renewal. Note: authorizing another MCP client (e.g. Claude, ChatGPT) does NOT add a new bank - use add_bank_connection to connect additional banks.",
      inputSchema: {},
    },
    async () => {
      const infos = await connectionInfos();
      if (typeof infos === "string") return textContent(infos);
      return textContent(JSON.stringify({ connections: infos }, null, 2));
    }
  );

  server.registerTool(
    "list_accounts",
    {
      description:
        "List connected bank accounts across the connections this client can access. Shows account names, IBANs, currencies, types, and which connection group they belong to. Note: authorizing another MCP client (e.g. Claude, ChatGPT) does NOT add a new bank - use add_bank_connection to connect additional banks.",
      inputSchema: {
        group: z
          .string()
          .optional()
          .describe("Filter accounts by connection group/label (e.g., 'Personal', 'Business') or connection id"),
      },
    },
    async ({ group }) => {
      const scope = await getScope();
      const allSessions = await scopedSessions(env, scope);

      if (allSessions.length === 0) {
        return textContent(
          "No bank account connected. Please visit the setup page at /setup to connect your bank."
        );
      }

      const g = group?.toLowerCase();
      const connections = allSessions
        .filter((s) => !g || s.label.toLowerCase() === g || s.connectionId.toLowerCase() === g)
        .map((session) => ({
          group: session.label,
          connectionId: session.connectionId,
          bank: session.aspspName,
          country: session.aspspCountry,
          psuType: session.psuType || "personal",
          consentValidUntil: session.consentValidUntil,
          consentExpired: isConsentExpired(session),
          accounts: session.accounts.map((acc) => ({
            id: acc.accountId,
            name: acc.name || "Unknown",
            iban: acc.iban || "N/A",
            currency: acc.currency || "N/A",
            type: acc.accountType || "N/A",
          })),
        }));

      if (connections.length === 0) {
        return textContent(
          `No connection found with group label "${group}". Use list_accounts without a group filter to see all connections.`
        );
      }

      const expiredConnections = connections.filter((c) => c.consentExpired);
      if (expiredConnections.length > 0 && expiredConnections.length === connections.length) {
        return textContent(
          `All bank consents have expired. Please reconnect your bank accounts by visiting the setup page at /setup`
        );
      }

      return await ok(
        JSON.stringify(
          {
            totalConnections: connections.length,
            totalAccounts: connections.reduce((sum, c) => sum + c.accounts.length, 0),
            connections,
            ...(expiredConnections.length > 0
              ? {
                  warning: `${expiredConnections.length} connection(s) have expired consent: ${expiredConnections.map((c) => c.group).join(", ")}`,
                }
              : {}),
          },
          null,
          2
        ),
        scope
      );
    }
  );

  server.registerTool(
    "get_balances",
    {
      description:
        "Get current balances (e.g. booked, available). Give account_id for one account, or omit it to get balances for all accounts, optionally limited to one connection group.",
      inputSchema: { account_id: accountIdSchema, ...filterSchema },
    },
    async ({ account_id, group }) => {
      const scope = await getScope();
      const { targets, error, skippedExpired } = await resolveTargets(env, scope, { account_id, group });
      if (error) return textContent(error);

      const client = await EnableBankingClient.create(env);
      const results = [];
      for (const t of targets) {
        const balances = await client.getBalances(t.account.accountId);
        results.push({
          group: t.label,
          accountId: t.account.accountId,
          account: accountName(t),
          balances: balances.balances.map((b) => ({
            type: b.balance_type,
            amount: formatAmount(b.balance_amount.amount, b.balance_amount.currency),
            currency: b.balance_amount.currency,
            date: b.reference_date || "N/A",
          })),
        });
      }

      const body = account_id
        ? { group: results[0].group, account: results[0].account, balances: results[0].balances }
        : withSkipped({ accounts: results }, skippedExpired);
      return await ok(JSON.stringify(body, null, 2), scope);
    }
  );

  server.registerTool(
    "get_transactions",
    {
      description:
        "Get transactions within a date range. Give account_id for one account (supports pagination), or omit it to get transactions for all accounts, optionally limited to one connection group.",
      inputSchema: {
        account_id: accountIdSchema,
        ...filterSchema,
        date_from: z
          .string()
          .optional()
          .describe("Start date in YYYY-MM-DD format (defaults to 30 days ago)"),
        date_to: z
          .string()
          .optional()
          .describe("End date in YYYY-MM-DD format (defaults to today)"),
        continuation_key: z
          .string()
          .optional()
          .describe("Pagination key from previous response (requires account_id)"),
      },
    },
    async ({ account_id, group, date_from, date_to, continuation_key }) => {
      if (continuation_key && !account_id) {
        return textContent("continuation_key requires account_id.");
      }
      const scope = await getScope();
      const { targets, error, skippedExpired } = await resolveTargets(env, scope, { account_id, group });
      if (error) return textContent(error);

      const client = await EnableBankingClient.create(env);
      const toDate = date_to || new Date().toISOString().split("T")[0];
      const fromDate =
        date_from ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const formatTx = (tx: Transaction, status: string) => ({
        id: tx.transaction_id || tx.entry_reference || "N/A",
        date: tx.booking_date || tx.value_date || "N/A",
        amount: formatAmount(tx.transaction_amount.amount, tx.transaction_amount.currency),
        currency: tx.transaction_amount.currency,
        counterparty: tx.creditor_name || tx.debtor_name || "Unknown",
        description: (tx.remittance_information || []).join(", ") || "N/A",
        status,
      });

      const results = [];
      for (const t of targets) {
        const txResult = await client.getTransactions(t.account.accountId, fromDate, toDate, continuation_key);
        results.push({
          group: t.label,
          accountId: t.account.accountId,
          account: accountName(t),
          transactions: [
            ...txResult.transactions.booked.map((tx) => formatTx(tx, "booked")),
            ...(txResult.transactions.pending || []).map((tx) => formatTx(tx, "pending")),
          ],
          ...(txResult.continuation_key ? { continuation_key: txResult.continuation_key } : {}),
        });
      }

      const body = account_id
        ? {
            group: results[0].group,
            account: results[0].account,
            dateRange: { from: fromDate, to: toDate },
            transactions: results[0].transactions,
            ...(results[0].continuation_key ? { continuation_key: results[0].continuation_key } : {}),
          }
        : withSkipped({ dateRange: { from: fromDate, to: toDate }, accounts: results }, skippedExpired);
      return await ok(JSON.stringify(body, null, 2), scope);
    }
  );

  server.registerTool(
    "search_transactions",
    {
      description:
        "Search transactions by text in counterparty name or description (case-insensitive). Give account_id to search one account, or omit it to search all accounts, optionally limited to one connection group.",
      inputSchema: {
        account_id: accountIdSchema,
        ...filterSchema,
        query: z.string().describe("Search text to match in counterparty or description"),
        date_from: z
          .string()
          .optional()
          .describe("Start date in YYYY-MM-DD format (defaults to 90 days ago)"),
        date_to: z
          .string()
          .optional()
          .describe("End date in YYYY-MM-DD format (defaults to today)"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default 50)"),
      },
    },
    async ({ account_id, group, query, date_from, date_to, limit }) => {
      const scope = await getScope();
      const { targets, error, skippedExpired } = await resolveTargets(env, scope, { account_id, group });
      if (error) return textContent(error);

      const client = await EnableBankingClient.create(env);
      const toDate = date_to || new Date().toISOString().split("T")[0];
      const fromDate =
        date_from ||
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const queryLower = query.toLowerCase();
      const maxResults = limit || 50;
      const matches: Array<Record<string, string>> = [];

      for (const t of targets) {
        if (matches.length >= maxResults) break;
        let continuationKey: string | undefined;
        do {
          const txResult = await client.getTransactions(t.account.accountId, fromDate, toDate, continuationKey);
          for (const tx of txResult.transactions.booked) {
            const counterparty = tx.creditor_name || tx.debtor_name || "";
            const description = (tx.remittance_information || []).join(" ");
            if (
              counterparty.toLowerCase().includes(queryLower) ||
              description.toLowerCase().includes(queryLower)
            ) {
              matches.push({
                id: tx.transaction_id || tx.entry_reference || "N/A",
                date: tx.booking_date || tx.value_date || "N/A",
                amount: formatAmount(tx.transaction_amount.amount, tx.transaction_amount.currency),
                counterparty: counterparty || "Unknown",
                description: description || "N/A",
                ...(account_id ? {} : { group: t.label, accountId: t.account.accountId, account: accountName(t) }),
              });
              if (matches.length >= maxResults) break;
            }
          }
          continuationKey = txResult.continuation_key;
        } while (continuationKey && matches.length < maxResults);
      }

      const body = withSkipped(
        {
          ...(account_id ? { group: targets[0].label } : {}),
          query,
          dateRange: { from: fromDate, to: toDate },
          matchCount: matches.length,
          transactions: matches,
        },
        skippedExpired
      );
      return await ok(JSON.stringify(body, null, 2), scope);
    }
  );

  server.registerTool(
    "summarize_spending",
    {
      description:
        "Summarize spending and income by category for a month. Give account_id for one account, or omit it to combine all accounts, optionally limited to one connection group.",
      inputSchema: {
        account_id: accountIdSchema,
        ...filterSchema,
        month: z
          .string()
          .optional()
          .describe(
            "Month in YYYY-MM format (defaults to current month). Use 'last3' for last 3 months."
          ),
      },
    },
    async ({ account_id, group, month }) => {
      const scope = await getScope();
      const { targets, error, skippedExpired } = await resolveTargets(env, scope, { account_id, group });
      if (error) return textContent(error);

      const client = await EnableBankingClient.create(env);

      let fromDate: string;
      let toDate: string;
      if (month === "last3") {
        const now = new Date();
        toDate = now.toISOString().split("T")[0];
        now.setMonth(now.getMonth() - 3);
        fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      } else {
        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const [year, mon] = targetMonth.split("-").map(Number);
        fromDate = `${year}-${String(mon).padStart(2, "0")}-01`;
        const lastDay = new Date(year, mon, 0).getDate();
        toDate = `${year}-${String(mon).padStart(2, "0")}-${lastDay}`;
      }

      const allTransactions: Transaction[] = [];
      for (const t of targets) {
        let continuationKey: string | undefined;
        do {
          const txResult = await client.getTransactions(t.account.accountId, fromDate, toDate, continuationKey);
          allTransactions.push(...txResult.transactions.booked);
          continuationKey = txResult.continuation_key;
        } while (continuationKey);
      }

      const spending: Record<string, number> = {};
      const income: Record<string, number> = {};
      let totalSpending = 0;
      let totalIncome = 0;
      for (const tx of allTransactions) {
        const amount = parseFloat(tx.transaction_amount.amount);
        const category = categorizeTransaction(tx);
        if (amount < 0) {
          const absAmount = Math.abs(amount);
          spending[category] = (spending[category] || 0) + absAmount;
          totalSpending += absAmount;
        } else {
          income[category] = (income[category] || 0) + amount;
          totalIncome += amount;
        }
      }

      const sortByValue = (obj: Record<string, number>) =>
        Object.entries(obj)
          .sort(([, a], [, b]) => b - a)
          .map(([category, amount]) => ({ category, amount: amount.toFixed(2) }));

      const groups = [...new Set(targets.map((t) => t.label))];
      const body = withSkipped(
        {
          group: groups.length === 1 ? groups[0] : groups,
          ...(account_id ? {} : { accountCount: targets.length }),
          period: { from: fromDate, to: toDate },
          transactionCount: allTransactions.length,
          summary: {
            totalSpending: totalSpending.toFixed(2),
            totalIncome: totalIncome.toFixed(2),
            netFlow: (totalIncome - totalSpending).toFixed(2),
          },
          spendingByCategory: sortByValue(spending),
          incomeByCategory: sortByValue(income),
        },
        skippedExpired
      );
      return await ok(JSON.stringify(body, null, 2), scope);
    }
  );

  server.registerTool(
    "add_bank_connection",
    {
      description:
        "Start adding a new bank connection (e.g. a business account or another bank). Returns a one-time URL (valid 1 hour) the user opens to log in and approve access at their bank (e.g. MitID). " +
        "Authorizing another MCP client does NOT add a bank; use this tool or /setup. Existing connections are not affected. If this client is limited to some connections, the new one is added to its access automatically.",
      inputSchema: {
        label: z.string().describe("A label for this connection (e.g. 'Holm & Friis Holding', 'Personal Account')"),
        psu_type: z
          .enum(["personal", "business"])
          .optional()
          .describe("Type of account: 'personal' (default) or 'business'"),
        country: z
          .string()
          .optional()
          .describe("Two-letter country code (e.g. 'DK', 'SE'). Defaults to 'DK'"),
        bank: z
          .string()
          .optional()
          .describe("Bank name to pre-select. If it matches exactly one bank, bank selection is skipped"),
      },
    },
    async ({ label, psu_type, country, bank }) => {
      const baseUrl = await getBaseUrl(env.BANKING_KV);
      if (!baseUrl) {
        return textContent("Base URL not configured. Please visit the setup page first.");
      }
      const scope = await getScope();
      const token = crypto.randomUUID();
      const psuType = psu_type || "personal";
      const countryCode = (country || "DK").toUpperCase();
      await storeConnectRequest(env.BANKING_KV, token, {
        label,
        psuType,
        country: countryCode,
        bankName: bank,
        createdAt: Date.now(),
        // Only scoped tokens need the new connection added explicitly; "all" sees it anyway.
        ...(!scope.all && scope.scopeKey ? { scopeKey: scope.scopeKey } : {}),
      });
      return textContent(
        JSON.stringify(
          {
            url: `${baseUrl}/connect?token=${token}`,
            label,
            psuType,
            country: countryCode,
            bank: bank || null,
            expiresIn: "1 hour",
            instructions:
              "Open this URL to authorize the bank connection. You will need to log in to the setup page first.",
          },
          null,
          2
        )
      );
    }
  );

  return server;
}

