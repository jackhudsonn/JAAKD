#!/usr/bin/env node

const { randomUUID } = require("node:crypto");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

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
        instrumentClass: "STOCK",
      },
      {
        ticker: "MSFT",
        market: "NASDAQ",
        name: "Microsoft Corp",
        instrumentClass: "STOCK",
      },
      {
        ticker: "TSLA",
        market: "NASDAQ",
        name: "Tesla Inc",
        instrumentClass: "STOCK",
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
        quantity: 10000,
      },
      {
        key: "buy-aapl-01",
        ticker: "AAPL",
        side: "BUY",
        quantity: 12,
        executionPrice: 192.75,
      },
      {
        key: "buy-msft-01",
        ticker: "MSFT",
        side: "BUY",
        quantity: 8,
        executionPrice: 415.1,
      },
      {
        key: "buy-tsla-01",
        ticker: "TSLA",
        side: "BUY",
        quantity: 4,
        executionPrice: 228.35,
      },
      {
        key: "sell-aapl-01",
        ticker: "AAPL",
        side: "SELL",
        quantity: 2,
        executionPrice: 205.2,
      },
    ],
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
        instrumentClass: "STOCK",
      },
      {
        ticker: "AMZN",
        market: "NASDAQ",
        name: "Amazon.com Inc",
        instrumentClass: "STOCK",
      },
      {
        ticker: "GOOGL",
        market: "NASDAQ",
        name: "Alphabet Inc Class A",
        instrumentClass: "STOCK",
      },
      {
        ticker: "META",
        market: "NASDAQ",
        name: "Meta Platforms Inc",
        instrumentClass: "STOCK",
      },
      {
        ticker: "JPM",
        market: "NYSE",
        name: "JPMorgan Chase & Co",
        instrumentClass: "STOCK",
      },
      {
        ticker: "XOM",
        market: "NYSE",
        name: "Exxon Mobil Corp",
        instrumentClass: "STOCK",
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
      "BNDX",
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
        instrumentClass: "STOCK",
      },
      {
        ticker: "MSFT",
        market: "NASDAQ",
        name: "Microsoft Corp",
        instrumentClass: "STOCK",
      },
      {
        ticker: "NVDA",
        market: "NASDAQ",
        name: "NVIDIA Corp",
        instrumentClass: "STOCK",
      },
      {
        ticker: "AMZN",
        market: "NASDAQ",
        name: "Amazon.com Inc",
        instrumentClass: "STOCK",
      },
      {
        ticker: "GOOGL",
        market: "NASDAQ",
        name: "Alphabet Inc Class A",
        instrumentClass: "STOCK",
      },
      {
        ticker: "META",
        market: "NASDAQ",
        name: "Meta Platforms Inc",
        instrumentClass: "STOCK",
      },
      {
        ticker: "JPM",
        market: "NYSE",
        name: "JPMorgan Chase & Co",
        instrumentClass: "STOCK",
      },
      {
        ticker: "XOM",
        market: "NYSE",
        name: "Exxon Mobil Corp",
        instrumentClass: "STOCK",
      },
      {
        ticker: "VOO",
        market: "NYSE",
        name: "Vanguard S&P 500 ETF",
        instrumentClass: "ETF",
      },
      {
        ticker: "BNDX",
        market: "NASDAQ",
        name: "Vanguard Total International Bond ETF",
        instrumentClass: "ETF",
      },
      {
        ticker: "TLT",
        market: "NASDAQ",
        name: "iShares 20+ Year Treasury Bond ETF",
        instrumentClass: "BOND",
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
        quantity: 150000,
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
        key: "buy-bndx-01",
        ticker: "BNDX",
        side: "BUY",
        quantity: 120,
        executionPrice: 49.25,
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

const CASH_INSTRUMENTS = [
  {
    ticker: "USD",
    market: "INTERNAL",
    name: "US Dollar Cash Balance",
    instrumentClass: "CASH",
    description: "Base cash ledger for USD balances",
  },
  {
    ticker: "INR",
    market: "INTERNAL",
    name: "Indian Rupee Cash Balance",
    instrumentClass: "CASH",
    description: "Cash ledger instrument for INR balances",
  },
  {
    ticker: "EUR",
    market: "INTERNAL",
    name: "Euro Cash Balance",
    instrumentClass: "CASH",
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

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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

    const error = new Error(message);
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

function extractSessionCookie(headers) {
  const setCookie = headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Login succeeded but no set-cookie header was returned.");
  }

  return setCookie.split(";")[0];
}

async function registerAndLogin(user) {
  try {
    await requestJson({
      method: "POST",
      path: "/api/auth/register",
      body: { email: user.email, password: user.password },
      expectedStatuses: [201, 409],
    });
  } catch (error) {
    if (error.status !== 409) {
      throw error;
    }
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
      const accountLast4 = String(method.accountLast4 || "").trim();
      const routingLast4 = String(method.routingLast4 || "").trim();

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

  for (const event of scenario.orders) {
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

    await requestJson({
      method: "POST",
      path: "/api/order-logs",
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

async function seedScenario(scenario) {
  const cookie = await registerAndLogin(scenario);
  await ensureProfile(cookie, scenario.profile);
  const paymentMethods = await ensurePaymentMethods(cookie, scenario);
  const portfolio = await ensurePortfolio(cookie, scenario.portfolioName);
  const instrumentsByTicker = await ensureInstruments(cookie, scenario);
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
    USERS.map((user) => ({
      level: user.level,
      email: user.email,
      password: user.password,
    })),
  );
}

async function main() {
  console.log(`Seeding demo users using backend: ${BACKEND_URL}`);
  printCredentials();

  const summaries = [];

  for (const scenario of USERS) {
    console.log(`Seeding level: ${scenario.level}`);
    const summary = await seedScenario(scenario);
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
