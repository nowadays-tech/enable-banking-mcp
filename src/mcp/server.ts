import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Env, BankSession, Transaction, ConnectionStatusInfo } from "../types";
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

async function getExpiryWarning(env: Env): Promise<string | null> {
  const baseUrl = await getBaseUrl(env.BANKING_KV);
  if (!baseUrl) return null;
  const sessions = await getAllSessions(env.BANKING_KV);
  const index = await getConnectionIndex(env.BANKING_KV);
  return buildExpiryWarning(withLabels(sessions, index), baseUrl);
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

export function createBankingMcpServer(env: Env) {
  const server = new McpServer({
    name: "enable-banking-mcp",
    version: "1.0.0",
  });

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

  const ok = async (text: string) =>
    textContent(appendExpiryWarning(text, await getExpiryWarning(env)));

  server.registerTool(
    "connection_status",
    {
      description:
        "List all bank connections with their consent status (ok, expiring, expired), expiry date, days left, and a renewal link. Use this to check which connections need renewal. Note: authorizing another MCP client (e.g. Claude, ChatGPT) does NOT add a new bank - use add_bank_connection to connect additional banks.",
      inputSchema: {},
    },
    async () => {
      const baseUrl = await getBaseUrl(env.BANKING_KV);
      if (!baseUrl) {
        return textContent("Base URL not configured. Please visit the setup page first.");
      }
      const sessions = await getAllSessions(env.BANKING_KV);
      if (sessions.length === 0) {
        return textContent(
          "No bank connections found. Please visit the setup page at /setup to connect your bank."
        );
      }
      const index = await getConnectionIndex(env.BANKING_KV);
      const connections: ConnectionStatusInfo[] = withLabels(sessions, index).map((session) =>
        buildConnectionInfo(session, baseUrl)
      );
      return textContent(JSON.stringify({ connections }, null, 2));
    }
  );

  server.registerTool(
    "list_accounts",
    {
      description:
        "List all connected bank accounts across all connections. Shows account names, IBANs, currencies, types, and which connection group they belong to. Note: authorizing another MCP client (e.g. Claude, ChatGPT) does NOT add a new bank - use add_bank_connection to connect additional banks.",
      inputSchema: {
        group: z
          .string()
          .optional()
          .describe("Filter accounts by connection group/label (e.g., 'Personal', 'Business')"),
      },
    },
    async ({ group }) => {
      const allSessions = await getAllSessions(env.BANKING_KV);
      const connectionIndex = await getConnectionIndex(env.BANKING_KV);

      if (allSessions.length === 0) {
        return textContent(
          "No bank account connected. Please visit the setup page at /setup to connect your bank."
        );
      }

      const connections: Array<{
        group: string;
        connectionId: string;
        bank: string;
        country: string;
        psuType: string;
        consentValidUntil: string;
        consentExpired: boolean;
        accounts: Array<{
          id: string;
          name: string;
          iban: string;
          currency: string;
          type: string;
        }>;
      }> = [];

      for (const session of allSessions) {
        const connInfo = connectionIndex?.connections.find(c => c.id === session.connectionId);
        const label = connInfo?.label || session.label || (session.connectionId === "default" ? "Default" : session.aspspName);
        
        if (group && label.toLowerCase() !== group.toLowerCase()) {
          continue;
        }
        
        const expired = isConsentExpired(session);
        
        connections.push({
          group: label,
          connectionId: session.connectionId,
          bank: session.aspspName,
          country: session.aspspCountry,
          psuType: connInfo?.psuType || session.psuType || "personal",
          consentValidUntil: session.consentValidUntil,
          consentExpired: expired,
          accounts: session.accounts.map((acc) => ({
            id: acc.accountId,
            name: acc.name || "Unknown",
            iban: acc.iban || "N/A",
            currency: acc.currency || "N/A",
            type: acc.accountType || "N/A",
          })),
        });
      }

      if (connections.length === 0) {
        return textContent(
          group 
            ? `No connection found with group label "${group}". Use list_accounts without a group filter to see all connections.`
            : "No bank account connected. Please visit the setup page at /setup to connect your bank."
        );
      }

      const expiredConnections = connections.filter(c => c.consentExpired);
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
            ...(expiredConnections.length > 0 ? {
              warning: `${expiredConnections.length} connection(s) have expired consent: ${expiredConnections.map(c => c.group).join(", ")}`
            } : {}),
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "get_balances",
    {
      description:
        "Get the current balance for a specific bank account. Returns all available balance types (e.g., booked, available). The account_id is automatically resolved to the correct bank connection.",
      inputSchema: {
        account_id: z.string().describe("The account ID to get balances for"),
      },
    },
    async ({ account_id }) => {
      const result = await findConnectionByAccountId(env.BANKING_KV, account_id);

      if (!result) {
        const allSessions = await getAllSessions(env.BANKING_KV);
        if (allSessions.length === 0) {
          return textContent(
            "No bank account connected. Please visit /setup to connect your bank."
          );
        }
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const { session } = result;

      if (isConsentExpired(session)) {
        const connectionIndex = await getConnectionIndex(env.BANKING_KV);
        const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
        const label = connInfo?.label || session.label || session.aspspName;
        return textContent(await expiredMessage(env, label, result.connectionId));
      }

      const account = session.accounts.find((a) => a.accountId === account_id);
      if (!account) {
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const client = await EnableBankingClient.create(env);
      const balances = await client.getBalances(account_id);

      const connectionIndex = await getConnectionIndex(env.BANKING_KV);
      const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
      const groupLabel = connInfo?.label || session.label || (result.connectionId === "default" ? "Default" : session.aspspName);

      const formatted = balances.balances.map((b) => ({
        type: b.balance_type,
        amount: formatAmount(b.balance_amount.amount, b.balance_amount.currency),
        currency: b.balance_amount.currency,
        date: b.reference_date || "N/A",
      }));

      return await ok(
        JSON.stringify(
          {
            group: groupLabel,
            account: account.name || account.iban || account_id,
            balances: formatted,
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "get_transactions",
    {
      description:
        "Get transactions for a bank account within a date range. Supports pagination for large result sets. The account_id is automatically resolved to the correct bank connection.",
      inputSchema: {
        account_id: z.string().describe("The account ID to get transactions for"),
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
          .describe("Pagination key from previous response"),
      },
    },
    async ({ account_id, date_from, date_to, continuation_key }) => {
      const result = await findConnectionByAccountId(env.BANKING_KV, account_id);

      if (!result) {
        const allSessions = await getAllSessions(env.BANKING_KV);
        if (allSessions.length === 0) {
          return textContent(
            "No bank account connected. Please visit /setup to connect your bank."
          );
        }
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const { session } = result;

      if (isConsentExpired(session)) {
        const connectionIndex = await getConnectionIndex(env.BANKING_KV);
        const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
        const label = connInfo?.label || session.label || session.aspspName;
        return textContent(await expiredMessage(env, label, result.connectionId));
      }

      const account = session.accounts.find((a) => a.accountId === account_id);
      if (!account) {
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const client = await EnableBankingClient.create(env);

      const toDate = date_to || new Date().toISOString().split("T")[0];
      const fromDate =
        date_from ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const txResult = await client.getTransactions(
        account_id,
        fromDate,
        toDate,
        continuation_key
      );

      const connectionIndex = await getConnectionIndex(env.BANKING_KV);
      const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
      const groupLabel = connInfo?.label || session.label || (result.connectionId === "default" ? "Default" : session.aspspName);

      const formatTx = (tx: Transaction, status: string) => ({
        id: tx.transaction_id || tx.entry_reference || "N/A",
        date: tx.booking_date || tx.value_date || "N/A",
        amount: formatAmount(
          tx.transaction_amount.amount,
          tx.transaction_amount.currency
        ),
        currency: tx.transaction_amount.currency,
        counterparty: tx.creditor_name || tx.debtor_name || "Unknown",
        description: (tx.remittance_information || []).join(", ") || "N/A",
        status,
      });

      const transactions = [
        ...txResult.transactions.booked.map((tx) => formatTx(tx, "booked")),
        ...(txResult.transactions.pending || []).map((tx) => formatTx(tx, "pending")),
      ];

      return await ok(
        JSON.stringify(
          {
            group: groupLabel,
            account: account.name || account.iban || account_id,
            dateRange: { from: fromDate, to: toDate },
            transactions,
            ...(txResult.continuation_key
              ? { continuation_key: txResult.continuation_key }
              : {}),
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "search_transactions",
    {
      description:
        "Search transactions by text in counterparty name or description. Case-insensitive. The account_id is automatically resolved to the correct bank connection.",
      inputSchema: {
        account_id: z.string().describe("The account ID to search transactions in"),
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
    async ({ account_id, query, date_from, date_to, limit }) => {
      const result = await findConnectionByAccountId(env.BANKING_KV, account_id);

      if (!result) {
        const allSessions = await getAllSessions(env.BANKING_KV);
        if (allSessions.length === 0) {
          return textContent(
            "No bank account connected. Please visit /setup to connect your bank."
          );
        }
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const { session } = result;

      if (isConsentExpired(session)) {
        const connectionIndex = await getConnectionIndex(env.BANKING_KV);
        const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
        const label = connInfo?.label || session.label || session.aspspName;
        return textContent(await expiredMessage(env, label, result.connectionId));
      }

      const connectionIndex = await getConnectionIndex(env.BANKING_KV);
      const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
      const groupLabel = connInfo?.label || session.label || (result.connectionId === "default" ? "Default" : session.aspspName);

      const client = await EnableBankingClient.create(env);
      const toDate = date_to || new Date().toISOString().split("T")[0];
      const fromDate =
        date_from ||
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const queryLower = query.toLowerCase();
      const maxResults = limit || 50;
      const matches: Array<{
        id: string;
        date: string;
        amount: string;
        counterparty: string;
        description: string;
      }> = [];

      let continuationKey: string | undefined;
      do {
        const txResult = await client.getTransactions(
          account_id,
          fromDate,
          toDate,
          continuationKey
        );

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
              amount: formatAmount(
                tx.transaction_amount.amount,
                tx.transaction_amount.currency
              ),
              counterparty: counterparty || "Unknown",
              description: description || "N/A",
            });

            if (matches.length >= maxResults) break;
          }
        }

        continuationKey = txResult.continuation_key;
      } while (continuationKey && matches.length < maxResults);

      return await ok(
        JSON.stringify(
          {
            group: groupLabel,
            query,
            dateRange: { from: fromDate, to: toDate },
            matchCount: matches.length,
            transactions: matches,
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "summarize_spending",
    {
      description:
        "Summarize spending by month and category. Shows total spending, income, and category breakdowns. The account_id is automatically resolved to the correct bank connection.",
      inputSchema: {
        account_id: z.string().describe("The account ID to summarize"),
        month: z
          .string()
          .optional()
          .describe(
            "Month in YYYY-MM format (defaults to current month). Use 'last3' for last 3 months."
          ),
      },
    },
    async ({ account_id, month }) => {
      const result = await findConnectionByAccountId(env.BANKING_KV, account_id);

      if (!result) {
        const allSessions = await getAllSessions(env.BANKING_KV);
        if (allSessions.length === 0) {
          return textContent(
            "No bank account connected. Please visit /setup to connect your bank."
          );
        }
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      const { session } = result;

      if (isConsentExpired(session)) {
        const connectionIndex = await getConnectionIndex(env.BANKING_KV);
        const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
        const label = connInfo?.label || session.label || session.aspspName;
        return textContent(await expiredMessage(env, label, result.connectionId));
      }

      const connectionIndex = await getConnectionIndex(env.BANKING_KV);
      const connInfo = connectionIndex?.connections.find(c => c.id === result.connectionId);
      const groupLabel = connInfo?.label || session.label || (result.connectionId === "default" ? "Default" : session.aspspName);

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
      let continuationKey: string | undefined;

      do {
        const txResult = await client.getTransactions(
          account_id,
          fromDate,
          toDate,
          continuationKey
        );
        allTransactions.push(...txResult.transactions.booked);
        continuationKey = txResult.continuation_key;
      } while (continuationKey);

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
          .map(([category, amount]) => ({
            category,
            amount: amount.toFixed(2),
          }));

      return await ok(
        JSON.stringify(
          {
            group: groupLabel,
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
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    "add_bank_connection",
    {
      description:
        "Start adding a new bank connection (e.g. a business account or another bank). Returns a one-time URL (valid 1 hour) the user opens to log in with the setup password and approve access at their bank (e.g. MitID). " +
        "Authorizing another MCP client does NOT add a bank; use this tool or /setup. Existing connections are not affected.",
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
      const token = crypto.randomUUID();
      const psuType = psu_type || "personal";
      const countryCode = (country || "DK").toUpperCase();
      await storeConnectRequest(env.BANKING_KV, token, {
        label,
        psuType,
        country: countryCode,
        bankName: bank,
        createdAt: Date.now(),
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
              "Open this URL to authorize the bank connection. You will need to log in with your setup password first.",
          },
          null,
          2
        )
      );
    }
  );

  return server;
}
