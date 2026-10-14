import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Env, BankSession, Transaction, ConnectionInfo } from "../types";
import {
  EnableBankingClient,
  getStoredSession,
  getAllSessions,
  isConsentExpired,
  getConnectionStatus,
  getDaysUntilExpiry,
  getConnectionId,
  getConnectionLabel,
  buildConnectionInfo,
  buildExpiryWarning,
  isExpiredSessionError,
  getBaseUrl,
} from "../enable-banking/client";

function buildExpiredError(session: BankSession, baseUrl: string): string {
  const label = getConnectionLabel(session);
  const connectionId = getConnectionId(session);
  const renewUrl = `${baseUrl}/renew/${encodeURIComponent(connectionId)}`;
  return `Connection '${label}' has expired. Renew here: ${renewUrl}`;
}

async function getExpiryWarning(env: Env): Promise<string | null> {
  const baseUrl = await getBaseUrl(env.BANKING_KV);
  if (!baseUrl) return null;
  
  const sessions = await getAllSessions(env.BANKING_KV);
  return buildExpiryWarning(sessions, baseUrl);
}

function appendExpiryWarning(result: string, warning: string | null): string {
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

  server.registerTool(
    "connection_status",
    {
      description:
        "List all bank connections with their consent status, expiry dates, and renewal links. Use this to check which connections need renewal.",
      inputSchema: {},
    },
    async () => {
      const baseUrl = await getBaseUrl(env.BANKING_KV);
      if (!baseUrl) {
        return textContent(
          "Base URL not configured. Please visit the setup page first."
        );
      }

      const sessions = await getAllSessions(env.BANKING_KV);

      if (sessions.length === 0) {
        return textContent(
          "No bank connections found. Please visit the setup page at /setup to connect your bank."
        );
      }

      const connections: ConnectionInfo[] = sessions.map((session) =>
        buildConnectionInfo(session, baseUrl)
      );

      return textContent(JSON.stringify({ connections }, null, 2));
    }
  );

  server.registerTool(
    "list_accounts",
    {
      description:
        "List all connected bank accounts. Shows account names, IBANs, currencies, and types.",
      inputSchema: {},
    },
    async () => {
      const session = await getStoredSession(env.BANKING_KV);

      if (!session) {
        return textContent(
          "No bank account connected. Please visit the setup page at /setup to connect your bank."
        );
      }

      const baseUrl = await getBaseUrl(env.BANKING_KV);
      
      if (isConsentExpired(session)) {
        if (baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        return textContent(
          "Bank consent has expired. Please reconnect your bank account by visiting the setup page at /setup"
        );
      }

      const accounts = session.accounts.map((acc) => ({
        id: acc.accountId,
        name: acc.name || "Unknown",
        iban: acc.iban || "N/A",
        currency: acc.currency || "N/A",
        type: acc.accountType || "N/A",
      }));

      const result = JSON.stringify(
        {
          bank: session.aspspName,
          country: session.aspspCountry,
          consentValidUntil: session.consentValidUntil,
          accounts,
        },
        null,
        2
      );

      const expiryWarning = await getExpiryWarning(env);
      return textContent(appendExpiryWarning(result, expiryWarning));
    }
  );

  server.registerTool(
    "get_balances",
    {
      description:
        "Get the current balance for a specific bank account. Returns all available balance types (e.g., booked, available).",
      inputSchema: {
        account_id: z.string().describe("The account ID to get balances for"),
      },
    },
    async ({ account_id }) => {
      const session = await getStoredSession(env.BANKING_KV);

      if (!session) {
        return textContent(
          "No bank account connected. Please visit /setup to connect your bank."
        );
      }

      const baseUrl = await getBaseUrl(env.BANKING_KV);

      if (isConsentExpired(session)) {
        if (baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        return textContent(
          "Bank consent has expired. Please reconnect your bank account by visiting the setup page at /setup"
        );
      }

      const account = session.accounts.find((a) => a.accountId === account_id);
      if (!account) {
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      try {
        const client = await EnableBankingClient.create(env);
        const balances = await client.getBalances(account_id);

        const formatted = balances.balances.map((b) => ({
          type: b.balance_type,
          amount: formatAmount(b.balance_amount.amount, b.balance_amount.currency),
          currency: b.balance_amount.currency,
          date: b.reference_date || "N/A",
        }));

        const result = JSON.stringify(
          {
            account: account.name || account.iban || account_id,
            balances: formatted,
          },
          null,
          2
        );

        const expiryWarning = await getExpiryWarning(env);
        return textContent(appendExpiryWarning(result, expiryWarning));
      } catch (error) {
        if (isExpiredSessionError(error) && baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "get_transactions",
    {
      description:
        "Get transactions for a bank account within a date range. Supports pagination for large result sets.",
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
      const session = await getStoredSession(env.BANKING_KV);

      if (!session) {
        return textContent(
          "No bank account connected. Please visit /setup to connect your bank."
        );
      }

      const baseUrl = await getBaseUrl(env.BANKING_KV);

      if (isConsentExpired(session)) {
        if (baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        return textContent(
          "Bank consent has expired. Please reconnect your bank account by visiting the setup page at /setup"
        );
      }

      const account = session.accounts.find((a) => a.accountId === account_id);
      if (!account) {
        return textContent(
          `Account ${account_id} not found. Use list_accounts to see available accounts.`
        );
      }

      try {
        const client = await EnableBankingClient.create(env);

        const toDate = date_to || new Date().toISOString().split("T")[0];
        const fromDate =
          date_from ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const apiResult = await client.getTransactions(
          account_id,
          fromDate,
          toDate,
          continuation_key
        );

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
          ...apiResult.transactions.booked.map((tx) => formatTx(tx, "booked")),
          ...(apiResult.transactions.pending || []).map((tx) => formatTx(tx, "pending")),
        ];

        const result = JSON.stringify(
          {
            account: account.name || account.iban || account_id,
            dateRange: { from: fromDate, to: toDate },
            transactions,
            ...(apiResult.continuation_key
              ? { continuation_key: apiResult.continuation_key }
              : {}),
          },
          null,
          2
        );

        const expiryWarning = await getExpiryWarning(env);
        return textContent(appendExpiryWarning(result, expiryWarning));
      } catch (error) {
        if (isExpiredSessionError(error) && baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "search_transactions",
    {
      description:
        "Search transactions by text in counterparty name or description. Case-insensitive.",
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
      const session = await getStoredSession(env.BANKING_KV);

      if (!session) {
        return textContent(
          "No bank account connected. Please visit /setup to connect your bank."
        );
      }

      const baseUrl = await getBaseUrl(env.BANKING_KV);

      if (isConsentExpired(session)) {
        if (baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        return textContent(
          "Bank consent has expired. Please reconnect your bank account by visiting the setup page at /setup"
        );
      }

      try {
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
          const apiResult = await client.getTransactions(
            account_id,
            fromDate,
            toDate,
            continuationKey
          );

          for (const tx of apiResult.transactions.booked) {
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

          continuationKey = apiResult.continuation_key;
        } while (continuationKey && matches.length < maxResults);

        const result = JSON.stringify(
          {
            query,
            dateRange: { from: fromDate, to: toDate },
            matchCount: matches.length,
            transactions: matches,
          },
          null,
          2
        );

        const expiryWarning = await getExpiryWarning(env);
        return textContent(appendExpiryWarning(result, expiryWarning));
      } catch (error) {
        if (isExpiredSessionError(error) && baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "summarize_spending",
    {
      description:
        "Summarize spending by month and category. Shows total spending, income, and category breakdowns.",
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
      const session = await getStoredSession(env.BANKING_KV);

      if (!session) {
        return textContent(
          "No bank account connected. Please visit /setup to connect your bank."
        );
      }

      const baseUrl = await getBaseUrl(env.BANKING_KV);

      if (isConsentExpired(session)) {
        if (baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        return textContent(
          "Bank consent has expired. Please reconnect your bank account by visiting the setup page at /setup"
        );
      }

      try {
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
          const apiResult = await client.getTransactions(
            account_id,
            fromDate,
            toDate,
            continuationKey
          );
          allTransactions.push(...apiResult.transactions.booked);
          continuationKey = apiResult.continuation_key;
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

        const result = JSON.stringify(
          {
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
        );

        const expiryWarning = await getExpiryWarning(env);
        return textContent(appendExpiryWarning(result, expiryWarning));
      } catch (error) {
        if (isExpiredSessionError(error) && baseUrl) {
          return textContent(buildExpiredError(session, baseUrl));
        }
        throw error;
      }
    }
  );

  return server;
}
