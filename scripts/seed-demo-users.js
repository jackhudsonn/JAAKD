#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
const AUDITOR_CONTAINER = process.env.AUDITOR_DB_CONTAINER || "jaakd-postgres";

const AUDITOR_ACCOUNT = {
  userId: "7d01f6ba-39bf-4f09-b6f8-4adcaef2f7f4",
  email: "auditor@123.com",
  password: "12345678",
  role: "AUDITOR",
  profile: {
    userType: 2,
    firstName: "Dev",
    lastName: "Auditor",
    city: "Austin",
    state: "TX",
    country: "US",
    zipCode: "73301",
    username: "dev_auditor",
  },
};

// Instrument creation is admin-only, so instruments are created under this account.
const ADMIN_ACCOUNT = {
  userId: "3b8f5c1e-9a4d-4f2b-8c6e-1d2a7f9e0b45",
  email: "admin@123.com",
  password: "12345678",
  role: "ADMIN",
  profile: {
    userType: 1,
    firstName: "Dev",
    lastName: "Admin",
    city: "Austin",
    state: "TX",
    country: "US",
    zipCode: "73301",
    username: "dev_admin",
  },
};

const USERS = [
  {
    level: "newbie",
    email: "demo.newbie@jaakd.local",
    password: "DemoNewbie!12345",
    profile: {
      firstName: "Nina",
      lastName: "Newbie",
      city: "Austin",
      state: "TX",
      country: "USA",
      zipCode: "73301",
    },
    paymentMethods: [
      {
        nickname: "Primary checking",
        accountHolderName: "Nina Newbie",
        bankName: "Austin Community Bank",
        accountType: "checking",
        routingNumber: "111000025",
        accountNumber: "9001203412",
      },
    ],
    portfolioName: "Newbie Growth Portfolio",
    widgets: [
      "performance-graph",
      "watchlist",
      "portfolio-value",
      "allocation-by-asset",
    ],
    watchlist: ["AAPL", "MSFT", "TSLA", "VOO"],
    instruments: [
      {
        ticker: "AAPL",
        market: "NASDAQ",
        name: "Apple Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "MSFT",
        market: "NASDAQ",
        name: "Microsoft Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "TSLA",
        market: "NASDAQ",
        name: "Tesla Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "VOO",
        market: "NYSE",
        name: "Vanguard S&P 500 ETF",
        instrumentClass: "ETF",
      },
    ],
    orders: [],
  },
  {
    level: "intermediate",
    email: "demo.intermediate@jaakd.local",
    password: "DemoIntermediate!12345",
    profile: {
      firstName: "Ivy",
      lastName: "Intermediate",
      city: "Chicago",
      state: "IL",
      country: "USA",
      zipCode: "60601",
    },
    paymentMethods: [
      {
        nickname: "Salary account",
        accountHolderName: "Ivy Intermediate",
        bankName: "Midwest Federal Credit Union",
        accountType: "checking",
        routingNumber: "021000021",
        accountNumber: "665544332211",
      },
    ],
    portfolioName: "Intermediate Multi-Sector",
    widgets: [
      "watchlist",
      "performance-graph",
      "open-orders",
      "portfolio-value",
      "allocation-by-asset",
    ],
    watchlist: [
      "NVDA",
      "AMZN",
      "GOOGL",
      "META",
      "JPM",
      "XOM",
      "VOO",
      "EUR",
      "INR",
    ],
    instruments: [
      {
        ticker: "NVDA",
        market: "NASDAQ",
        name: "NVIDIA Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "AMZN",
        market: "NASDAQ",
        name: "Amazon.com Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "GOOGL",
        market: "NASDAQ",
        name: "Alphabet Inc Class A",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "META",
        market: "NASDAQ",
        name: "Meta Platforms Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "JPM",
        market: "NYSE",
        name: "JPMorgan Chase & Co",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "XOM",
        market: "NYSE",
        name: "Exxon Mobil Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "VOO",
        market: "NYSE",
        name: "Vanguard S&P 500 ETF",
        instrumentClass: "ETF",
      },
    ],
    orders: [
      {
        key: "usd-deposit-01",
        ticker: "USD",
        side: "DEPOSIT",
        quantity: 50000,
      },
      { key: "eur-deposit-01", ticker: "EUR", side: "DEPOSIT", quantity: 7000 },
      {
        key: "buy-voo-01",
        ticker: "VOO",
        side: "BUY",
        quantity: 35,
        executionPrice: 530.8,
      },
      {
        key: "buy-nvda-01",
        ticker: "NVDA",
        side: "BUY",
        quantity: 20,
        executionPrice: 121.25,
      },
      {
        key: "buy-amzn-01",
        ticker: "AMZN",
        side: "BUY",
        quantity: 15,
        executionPrice: 189.4,
      },
      {
        key: "buy-googl-01",
        ticker: "GOOGL",
        side: "BUY",
        quantity: 18,
        executionPrice: 176.9,
      },
      {
        key: "sell-nvda-01",
        ticker: "NVDA",
        side: "SELL",
        quantity: 5,
        executionPrice: 128.1,
      },
      {
        key: "sell-voo-01",
        ticker: "VOO",
        side: "SELL",
        quantity: 4,
        executionPrice: 541.3,
      },
      {
        key: "withdraw-usd-01",
        ticker: "USD",
        side: "WITHDRAW",
        quantity: 2500,
      },
    ],
  },
  {
    level: "pro",
    email: "demo.pro@jaakd.local",
    password: "DemoPro!12345",
    profile: {
      firstName: "Priya",
      lastName: "Pro",
      city: "New York",
      state: "NY",
      country: "USA",
      zipCode: "10001",
    },
    paymentMethods: [
      {
        nickname: "Operations checking",
        accountHolderName: "Priya Pro",
        bankName: "Manhattan Financial",
        accountType: "checking",
        routingNumber: "026009593",
        accountNumber: "3322110099887766",
      },
      {
        nickname: "Treasury savings",
        accountHolderName: "Priya Pro",
        bankName: "Manhattan Financial",
        accountType: "savings",
        routingNumber: "026009593",
        accountNumber: "4455667788990011",
      },
    ],
    portfolioName: "Pro Global Macro",
    widgets: [
      "top-movers",
      "performance-graph",
      "allocation-by-asset",
      "open-orders",
      "portfolio-value",
      "watchlist",
    ],
    watchlist: [
      "AAPL",
      "MSFT",
      "NVDA",
      "AMZN",
      "GOOGL",
      "META",
      "JPM",
      "XOM",
      "VOO",
      "TLT",
      "BTC",
      "ETH",
      "USD",
      "EUR",
      "INR",
    ],
    instruments: [
      {
        ticker: "AAPL",
        market: "NASDAQ",
        name: "Apple Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "MSFT",
        market: "NASDAQ",
        name: "Microsoft Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "NVDA",
        market: "NASDAQ",
        name: "NVIDIA Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "AMZN",
        market: "NASDAQ",
        name: "Amazon.com Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "GOOGL",
        market: "NASDAQ",
        name: "Alphabet Inc Class A",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "META",
        market: "NASDAQ",
        name: "Meta Platforms Inc",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "JPM",
        market: "NYSE",
        name: "JPMorgan Chase & Co",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "XOM",
        market: "NYSE",
        name: "Exxon Mobil Corp",
        instrumentClass: "EQUITY",
      },
      {
        ticker: "VOO",
        market: "NYSE",
        name: "Vanguard S&P 500 ETF",
        instrumentClass: "ETF",
      },
      {
        ticker: "TLT",
        market: "NASDAQ",
        name: "iShares 20+ Year Treasury Bond ETF",
        instrumentClass: "ETF",
      },
      {
        ticker: "BTC",
        market: "CRYPTO",
        name: "Bitcoin",
        instrumentClass: "CRYPTO",
      },
      {
        ticker: "ETH",
        market: "CRYPTO",
        name: "Ethereum",
        instrumentClass: "CRYPTO",
      },
    ],
    orders: [
      {
        key: "usd-deposit-01",
        ticker: "USD",
        side: "DEPOSIT",
        quantity: 1000000,
      },
      {
        key: "eur-deposit-01",
        ticker: "EUR",
        side: "DEPOSIT",
        quantity: 30000,
      },
      {
        key: "inr-deposit-01",
        ticker: "INR",
        side: "DEPOSIT",
        quantity: 4000000,
      },
      {
        key: "buy-voo-01",
        ticker: "VOO",
        side: "BUY",
        quantity: 70,
        executionPrice: 529.4,
      },
      {
        key: "buy-aapl-01",
        ticker: "AAPL",
        side: "BUY",
        quantity: 50,
        executionPrice: 193.25,
      },
      {
        key: "buy-msft-01",
        ticker: "MSFT",
        side: "BUY",
        quantity: 40,
        executionPrice: 412.6,
      },
      {
        key: "buy-nvda-01",
        ticker: "NVDA",
        side: "BUY",
        quantity: 60,
        executionPrice: 122.4,
      },
      {
        key: "buy-amzn-01",
        ticker: "AMZN",
        side: "BUY",
        quantity: 45,
        executionPrice: 188.7,
      },
      {
        key: "buy-googl-01",
        ticker: "GOOGL",
        side: "BUY",
        quantity: 55,
        executionPrice: 175.9,
      },
      {
        key: "buy-meta-01",
        ticker: "META",
        side: "BUY",
        quantity: 30,
        executionPrice: 506.2,
      },
      {
        key: "buy-jpm-01",
        ticker: "JPM",
        side: "BUY",
        quantity: 35,
        executionPrice: 209.15,
      },
      {
        key: "buy-xom-01",
        ticker: "XOM",
        side: "BUY",
        quantity: 70,
        executionPrice: 118.3,
      },
      {
        key: "buy-tlt-01",
        ticker: "TLT",
        side: "BUY",
        quantity: 85,
        executionPrice: 91.7,
      },
      {
        key: "buy-btc-01",
        ticker: "BTC",
        side: "BUY",
        quantity: 2.4,
        executionPrice: 62450,
      },
      {
        key: "buy-eth-01",
        ticker: "ETH",
        side: "BUY",
        quantity: 18,
        executionPrice: 3225,
      },
      {
        key: "sell-voo-01",
        ticker: "VOO",
        side: "SELL",
        quantity: 8,
        executionPrice: 545.4,
      },
      {
        key: "sell-nvda-01",
        ticker: "NVDA",
        side: "SELL",
        quantity: 12,
        executionPrice: 129.6,
      },
      {
        key: "sell-btc-01",
        ticker: "BTC",
        side: "SELL",
        quantity: 0.7,
        executionPrice: 66880,
      },
      {
        key: "withdraw-eur-01",
        ticker: "EUR",
        side: "WITHDRAW",
        quantity: 2500,
      },
      {
        key: "withdraw-inr-01",
        ticker: "INR",
        side: "WITHDRAW",
        quantity: 250000,
      },
    ],
  },
];

const PRO_EXTRA_ORDERS = [
  ["buy-aapl-02", "AAPL", "BUY", 20, 178.4],
  ["buy-msft-02", "MSFT", "BUY", 15, 396.2],
  ["buy-nvda-02", "NVDA", "BUY", 25, 108.3],
  ["buy-amzn-02", "AMZN", "BUY", 18, 164.7],
  ["buy-googl-02", "GOOGL", "BUY", 22, 151.6],
  ["buy-meta-02", "META", "BUY", 12, 472.9],
  ["buy-jpm-02", "JPM", "BUY", 20, 188.2],
  ["buy-xom-02", "XOM", "BUY", 30, 106.4],
  ["buy-tlt-02", "TLT", "BUY", 35, 87.5],
  ["buy-voo-02", "VOO", "BUY", 25, 505.1],
  ["buy-aapl-03", "AAPL", "BUY", 12, 184.6],
  ["buy-nvda-03", "NVDA", "BUY", 10, 114.8],
  ["buy-jpm-03", "JPM", "BUY", 8, 194.3],
  ["buy-xom-03", "XOM", "BUY", 12, 111.2],
  ["buy-voo-03", "VOO", "BUY", 14, 512.7],
  ["sell-aapl-02", "AAPL", "SELL", 5, 201.3],
  ["sell-msft-02", "MSFT", "SELL", 4, 431.7],
  ["sell-nvda-02", "NVDA", "SELL", 8, 136.4],
  ["sell-amzn-02", "AMZN", "SELL", 6, 198.1],
  ["sell-googl-02", "GOOGL", "SELL", 7, 181.2],
  ["sell-meta-02", "META", "SELL", 4, 538.5],
  ["sell-aapl-03", "AAPL", "SELL", 3, 209.7],
  ["sell-nvda-03", "NVDA", "SELL", 3, 142.5],
  ["sell-jpm-03", "JPM", "SELL", 2, 217.8],
  ["sell-xom-03", "XOM", "SELL", 4, 124.1],
  ["pending-voo-01", "VOO", "BUY", 10, 518.4, "PENDING"],
  ["rejected-tlt-01", "TLT", "BUY", 12, 93.2, "REJECTED"],
  ["failed-jpm-01", "JPM", "BUY", 9, 214.6, "FAILED"],
  ["cancelled-xom-01", "XOM", "SELL", 5, 121.8, "CANCELLED"],
];

const proScenario = USERS.find((scenario) => scenario.level === "pro");
for (const [key, ticker, side, quantity, executionPrice, status] of PRO_EXTRA_ORDERS) {
  proScenario.orders.push({
    key,
    ticker,
    side,
    quantity,
    executionPrice,
    status: status || "EXECUTED",
  });
}
proScenario.orders.push(
  {
    key: "usd-deposit-02",
    ticker: "USD",
    side: "DEPOSIT",
    quantity: 125000,
    status: "EXECUTED",
  },
  {
    key: "usd-withdraw-02",
    ticker: "USD",
    side: "WITHDRAW",
    quantity: 15000,
    status: "EXECUTED",
  },
  {
    key: "eur-deposit-02",
    ticker: "EUR",
    side: "DEPOSIT",
    quantity: 5000,
    status: "EXECUTED",
  },
  {
    key: "inr-deposit-02",
    ticker: "INR",
    side: "DEPOSIT",
    quantity: 300000,
    status: "EXECUTED",
  },
  {
    key: "eur-withdraw-02",
    ticker: "EUR",
    side: "WITHDRAW",
    quantity: 1000,
    status: "FAILED",
  },
);

const intermediateScenario = USERS.find(
  (scenario) => scenario.level === "intermediate",
);
intermediateScenario.orders.push(
  {
    key: "pending-googl-01",
    ticker: "GOOGL",
    side: "BUY",
    quantity: 6,
    executionPrice: 178.2,
    status: "PENDING",
  },
  {
    key: "rejected-meta-01",
    ticker: "META",
    side: "BUY",
    quantity: 4,
    executionPrice: 515.4,
    status: "REJECTED",
  },
  {
    key: "failed-jpm-01",
    ticker: "JPM",
    side: "BUY",
    quantity: 3,
    executionPrice: 203.1,
    status: "FAILED",
  },
);

const CASH_INSTRUMENTS = [
  {
    ticker: "USD",
    market: "INTERNAL",
    name: "US Dollar Cash Balance",
    instrumentClass: "CASH",
    tradingCurrency: "USD",
    description: "Base cash ledger for USD balances",
  },
  {
    ticker: "INR",
    market: "INTERNAL",
    name: "Indian Rupee Cash Balance",
    instrumentClass: "CASH",
    tradingCurrency: "INR",
    description: "Cash ledger instrument for INR balances",
  },
  {
    ticker: "EUR",
    market: "INTERNAL",
    name: "Euro Cash Balance",
    instrumentClass: "CASH",
    tradingCurrency: "EUR",
    description: "Cash ledger instrument for EUR balances",
  },
];

async function requestJson({
  method,
  path,
  cookie,
  body,
  expectedStatuses = [200],
}) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  let response;

  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message || error.message;
    throw new Error(
      `Unable to reach the backend at ${BACKEND_URL} while requesting ${method} ${path}: ${cause}. ` +
        "Start the backend with `docker compose up -d --build` or set BACKEND_URL to a reachable backend.",
      { cause: error },
    );
  }

  const rawText = await response.text();
  let parsed = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const message =
      parsed && typeof parsed === "object" && parsed.message
        ? parsed.message
        : `HTTP ${response.status} from ${method} ${path}`;

    const error = new Error(`${message} (${method} ${path})`);
    error.status = response.status;
    error.body = parsed;
    throw error;
  }

  return {
    status: response.status,
    data: parsed,
    headers: response.headers,
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensurePrivilegedAccount(account) {
  const sql = `
INSERT INTO users ("userID", email, roles)
VALUES (
  ${sqlLiteral(account.userId)},
  ${sqlLiteral(account.email)},
  ${sqlLiteral(`{${account.role}}`)}
)
ON CONFLICT ("userID") DO UPDATE
SET
  email = EXCLUDED.email,
  roles = EXCLUDED.roles;

INSERT INTO profiles (
  "userID",
  "userType",
  "firstName",
  "lastName",
  city,
  state,
  country,
  "zipCode",
  username,
  avatar
)
VALUES (
  ${sqlLiteral(account.userId)},
  ${account.profile.userType},
  ${sqlLiteral(account.profile.firstName)},
  ${sqlLiteral(account.profile.lastName)},
  ${sqlLiteral(account.profile.city)},
  ${sqlLiteral(account.profile.state)},
  ${sqlLiteral(account.profile.country)},
  ${sqlLiteral(account.profile.zipCode)},
  ${sqlLiteral(account.profile.username)},
  NULL
)
ON CONFLICT ("userID") DO UPDATE
SET
  "userType" = EXCLUDED."userType",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  "zipCode" = EXCLUDED."zipCode",
  username = EXCLUDED.username,
  avatar = EXCLUDED.avatar;

INSERT INTO development_credentials ("userID", email, "passwordHash")
VALUES (
  ${sqlLiteral(account.userId)},
  ${sqlLiteral(account.email)},
  crypt(${sqlLiteral(account.password)}, gen_salt('bf'))
)
ON CONFLICT (email) DO UPDATE
SET
  "userID" = EXCLUDED."userID",
  "passwordHash" = EXCLUDED."passwordHash";
`;

  execFileSync(
    "docker",
    [
      "exec", "-i", AUDITOR_CONTAINER,
      "psql",
      "-U", "postgres",
      "-d", "jaakd",
      "-v", "ON_ERROR_STOP=1",
      "-c", sql,
    ],
    { stdio: "pipe", encoding: "utf8" },
  );
}

function extractSessionCookie(headers) {
  const setCookie = headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Login succeeded but no set-cookie header was returned.");
  }

  return setCookie.split(";")[0];
}

async function registerAndLogin(user) {
  const registration = await requestJson({
    method: "POST",
    path: "/api/auth/register",
    body: { email: user.email, password: user.password },
    expectedStatuses: [201, 409],
  });

  if (registration.status === 409) {
    throw new Error(
      `Demo user ${user.email} already exists. Reset the local Postgres volume with ` +
        "`docker compose down -v && docker compose up -d --build`, then rerun the seed.",
    );
  }

  const login = await requestJson({
    method: "POST",
    path: "/api/auth/login",
    body: { email: user.email, password: user.password },
    expectedStatuses: [200],
  });

  return extractSessionCookie(login.headers);
}

async function ensureProfile(cookie, profile) {
  const current = await requestJson({
    method: "GET",
    path: "/api/profile",
    cookie,
    expectedStatuses: [200, 404],
  });

  if (current.status === 200) {
    return current.data;
  }

  const created = await requestJson({
    method: "POST",
    path: "/api/profile",
    cookie,
    body: profile,
    expectedStatuses: [201, 409],
  });

  if (created.status === 201) {
    return created.data;
  }

  const retry = await requestJson({
    method: "GET",
    path: "/api/profile",
    cookie,
    expectedStatuses: [200],
  });

  return retry.data;
}

async function ensurePaymentMethods(cookie, scenario) {
  const list = await requestJson({
    method: "GET",
    path: "/api/payment-methods",
    cookie,
    expectedStatuses: [200],
  });

  const existingSignatures = new Set(
    (Array.isArray(list.data) ? list.data : []).map((method) => {
      const nickname = String(method.nickname || "").trim().toLowerCase();
      const bankName = String(method.bankName || "").trim().toLowerCase();
      const accountType = String(method.accountType || "").trim().toLowerCase();
      const accountLast4 = String(method.accountNumberLast4 || "").trim();
      const routingLast4 = String(method.routingNumber || "")
        .trim()
        .slice(-4);

      return `${nickname}|${bankName}|${accountType}|${accountLast4}|${routingLast4}`;
    }),
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const method of scenario.paymentMethods ?? []) {
    const accountLast4 = method.accountNumber.slice(-4);
    const routingLast4 = method.routingNumber.slice(-4);
    const signature = `${method.nickname.trim().toLowerCase()}|${method.bankName
      .trim()
      .toLowerCase()}|${method.accountType.trim().toLowerCase()}|${accountLast4}|${routingLast4}`;

    if (existingSignatures.has(signature)) {
      skippedCount += 1;
      continue;
    }

    await requestJson({
      method: "POST",
      path: "/api/payment-methods",
      cookie,
      body: {
        nickname: method.nickname,
        accountHolderName: method.accountHolderName,
        bankName: method.bankName,
        accountType: method.accountType,
        routingNumber: method.routingNumber,
        accountNumber: method.accountNumber,
      },
      expectedStatuses: [201],
    });

    existingSignatures.add(signature);
    createdCount += 1;
  }

  const refreshed = await requestJson({
    method: "GET",
    path: "/api/payment-methods",
    cookie,
    expectedStatuses: [200],
  });

  return {
    createdCount,
    skippedCount,
    totalCount: Array.isArray(refreshed.data) ? refreshed.data.length : 0,
  };
}

async function ensurePortfolio(cookie, portfolioName) {
  const list = await requestJson({
    method: "GET",
    path: "/api/portfolios",
    cookie,
    expectedStatuses: [200],
  });

  const existing = Array.isArray(list.data)
    ? list.data.find((portfolio) => portfolio.portfolioName === portfolioName)
    : null;

  if (existing) {
    return existing;
  }

  const created = await requestJson({
    method: "POST",
    path: "/api/portfolios",
    cookie,
    body: { portfolioName },
    expectedStatuses: [201],
  });

  return created.data;
}

async function ensureInstrument(cookie, instrument) {
  const ticker = instrument.ticker.toUpperCase();

  const existing = await requestJson({
    method: "GET",
    path: `/api/instruments/ticker/${encodeURIComponent(ticker)}`,
    cookie,
    expectedStatuses: [200, 404],
  });

  if (existing.status === 200) {
    return existing.data;
  }

  const created = await requestJson({
    method: "POST",
    path: "/api/instruments",
    cookie,
    body: {
      ticker,
      market: instrument.market,
      name: instrument.name,
      instrumentClass: instrument.instrumentClass,
      tradingCurrency: instrument.tradingCurrency || "USD",
      logoUrl: instrument.logoUrl || null,
      description: instrument.description || null,
    },
    expectedStatuses: [201, 409],
  });

  if (created.status === 201) {
    return created.data;
  }

  const retry = await requestJson({
    method: "GET",
    path: `/api/instruments/ticker/${encodeURIComponent(ticker)}`,
    cookie,
    expectedStatuses: [200],
  });

  return retry.data;
}

async function ensureInstruments(cookie, scenario) {
  const specByTicker = new Map();

  for (const item of CASH_INSTRUMENTS) {
    specByTicker.set(item.ticker, item);
  }

  for (const item of scenario.instruments) {
    specByTicker.set(item.ticker, item);
  }

  const instrumentsByTicker = new Map();

  for (const item of specByTicker.values()) {
    const ensured = await ensureInstrument(cookie, item);
    instrumentsByTicker.set(ensured.ticker.toUpperCase(), ensured);
  }

  return instrumentsByTicker;
}

async function ensureWatchlist(
  cookie,
  portfolioId,
  scenario,
  instrumentsByTicker,
) {
  const current = await requestJson({
    method: "GET",
    path: `/api/watchlists/portfolio/${portfolioId}`,
    cookie,
    expectedStatuses: [200],
  });

  const existingInstrumentIds = new Set(
    (Array.isArray(current.data) ? current.data : []).map((item) =>
      String(item.instrumentId),
    ),
  );

  let createdCount = 0;

  for (const ticker of scenario.watchlist) {
    const instrument = instrumentsByTicker.get(ticker.toUpperCase());

    if (!instrument) {
      throw new Error(`Missing instrument ${ticker} while seeding watchlist.`);
    }

    if (existingInstrumentIds.has(String(instrument.instrumentId))) {
      continue;
    }

    await requestJson({
      method: "POST",
      path: "/api/watchlists",
      cookie,
      body: {
        portfolioId,
        instrumentId: instrument.instrumentId,
        name: `${scenario.level.toUpperCase()} ${ticker}`,
      },
      expectedStatuses: [201, 409],
    });

    createdCount += 1;
  }

  const refreshed = await requestJson({
    method: "GET",
    path: `/api/watchlists/portfolio/${portfolioId}`,
    cookie,
    expectedStatuses: [200],
  });

  return {
    createdCount,
    totalCount: Array.isArray(refreshed.data) ? refreshed.data.length : 0,
  };
}

async function seedOrders(cookie, portfolioId, scenario, instrumentsByTicker) {
  const list = await requestJson({
    method: "GET",
    path: `/api/order-logs/portfolio/${portfolioId}`,
    cookie,
    expectedStatuses: [200],
  });

  const existingMetadata = new Set(
    (Array.isArray(list.data) ? list.data : [])
      .map((item) => item.metadata)
      .filter((value) => typeof value === "string" && value.length > 0),
  );

  let submitted = 0;
  let skipped = 0;

  for (const [index, event] of scenario.orders.entries()) {
    const metadata = `seed:${scenario.level}:${event.key}`;

    if (existingMetadata.has(metadata)) {
      skipped += 1;
      continue;
    }

    const instrument = instrumentsByTicker.get(event.ticker.toUpperCase());

    if (!instrument) {
      throw new Error(
        `Missing instrument ${event.ticker} while seeding orders.`,
      );
    }

    const payload = {
      orderId: randomUUID(),
      portfolioId,
      instrumentId: instrument.instrumentId,
      side: event.side,
      quantity: event.quantity,
      metadata,
    };

    if (event.executionPrice !== undefined) {
      payload.executionPrice = event.executionPrice;
    }

    payload.status = event.status || "EXECUTED";
    if (event.timestamp) {
      payload.timestamp = event.timestamp;
    } else {
      const timestamp = new Date(Date.UTC(2025, 0, 1));
      timestamp.setUTCDate(timestamp.getUTCDate() + index * 18);
      payload.timestamp = timestamp.toISOString().slice(0, 19);
    }

    await requestJson({
      method: "POST",
      path: "/api/order-logs/demo",
      cookie,
      body: payload,
      expectedStatuses: [201],
    });

    submitted += 1;
  }

  return { submitted, skipped };
}

async function updatePreferences(cookie, portfolioId, widgets) {
  await requestJson({
    method: "PUT",
    path: `/api/preferences/portfolio/${portfolioId}`,
    cookie,
    body: { dashboardWidgets: widgets },
    expectedStatuses: [200],
  });
}

async function seedScenario(scenario, adminCookie) {
  const cookie = await registerAndLogin(scenario);
  await ensureProfile(cookie, scenario.profile);
  const paymentMethods = await ensurePaymentMethods(cookie, scenario);
  const portfolio = await ensurePortfolio(cookie, scenario.portfolioName);
  const instrumentsByTicker = await ensureInstruments(adminCookie, scenario);
  const watchlist = await ensureWatchlist(
    cookie,
    portfolio.portfolioId,
    scenario,
    instrumentsByTicker,
  );
  const orders = await seedOrders(
    cookie,
    portfolio.portfolioId,
    scenario,
    instrumentsByTicker,
  );
  await updatePreferences(cookie, portfolio.portfolioId, scenario.widgets);

  return {
    level: scenario.level,
    email: scenario.email,
    password: scenario.password,
    portfolioId: portfolio.portfolioId,
    watchlistTotal: watchlist.totalCount,
    watchlistCreated: watchlist.createdCount,
    paymentMethodsTotal: paymentMethods.totalCount,
    paymentMethodsCreated: paymentMethods.createdCount,
    paymentMethodsSkipped: paymentMethods.skippedCount,
    ordersSubmitted: orders.submitted,
    ordersSkipped: orders.skipped,
  };
}

function printCredentials() {
  console.log("Demo user credentials:");
  console.table(
    [
      ...USERS.map((user) => ({
        level: user.level,
        email: user.email,
        password: user.password,
      })),
      {
        level: "auditor",
        email: AUDITOR_ACCOUNT.email,
        password: AUDITOR_ACCOUNT.password,
      },
      {
        level: "admin",
        email: ADMIN_ACCOUNT.email,
        password: ADMIN_ACCOUNT.password,
      },
    ],
  );
}

async function main() {
  if (process.env.DEV_DEMO_USERS !== "true") {
    throw new Error(
      "Demo seeding is disabled. Run with DEV_DEMO_USERS=true to seed local demo accounts.",
    );
  }

  console.log(`Seeding demo users using backend: ${BACKEND_URL}`);
  printCredentials();

  ensurePrivilegedAccount(AUDITOR_ACCOUNT);
  ensurePrivilegedAccount(ADMIN_ACCOUNT);
  console.log(`Auditor and admin accounts seeded in ${AUDITOR_CONTAINER}.`);
  const adminCookie = await registerAndLogin(ADMIN_ACCOUNT);

  const summaries = [];

  for (const scenario of USERS) {
    console.log(`Seeding level: ${scenario.level}`);
    const summary = await seedScenario(scenario, adminCookie);
    summaries.push(summary);
    console.log(`Finished level: ${scenario.level}`);
  }

  console.log("Seeding complete. Summary:");
  console.table(
    summaries.map((item) => ({
      level: item.level,
      email: item.email,
      portfolioId: item.portfolioId,
      watchlistTotal: item.watchlistTotal,
      watchlistCreated: item.watchlistCreated,
      paymentMethodsTotal: item.paymentMethodsTotal,
      paymentMethodsCreated: item.paymentMethodsCreated,
      paymentMethodsSkipped: item.paymentMethodsSkipped,
      ordersSubmitted: item.ordersSubmitted,
      ordersSkipped: item.ordersSkipped,
    })),
  );

  console.log("Login credentials (for GUI):");
  console.table(
    summaries.map((item) => ({
      level: item.level,
      username: item.email,
      password: item.password,
    })),
  );
}

main().catch((error) => {
  console.error("Demo seed failed:", error.message);

  if (error.body) {
    console.error("Server response:", JSON.stringify(error.body, null, 2));
  }

  process.exit(1);
});
