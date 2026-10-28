#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
const AUDITOR_CONTAINER = process.env.AUDITOR_DB_CONTAINER || "jaakd-postgres";
const NETWORK_RETRY_ATTEMPTS = 5;
const NETWORK_RETRY_DELAY_MS = 1000;

const AUDITOR_ACCOUNT = {
  userId: "7d01f6ba-39bf-4f09-b6f8-4adcaef2f7f4",
  email: "auditor@123.com",
  password: "DemoAuditor!12345",
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
const ADMIN_ACCOUNT = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "ADMIN_ACCOUNT.json"), "utf-8"),
);
console.log(`Using backend URL: ${BACKEND_URL}`);

const USERS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "USERS.json"), "utf-8"),
);

function readInstrumentCatalog() {
  const contents = fs.readFileSync(
    path.resolve(__dirname, "instruments.csv"),
    "utf8",
  );
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && contents[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("Unterminated quoted field in scripts/instruments.csv.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift();
  const requiredHeaders = [
    "ticker",
    "market",
    "name",
    "instrumentClass",
    "tradingCurrency",
    "logoUrl",
    "description",
  ];

  if (!headers || requiredHeaders.some((header) => !headers.includes(header))) {
    throw new Error(
      `scripts/instruments.csv must include these columns: ${requiredHeaders.join(", ")}.`,
    );
  }

  const instruments = rows.map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `Invalid column count in scripts/instruments.csv at row ${rowIndex + 2}.`,
      );
    }

    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index].trim()]),
    );

    for (const header of requiredHeaders) {
      if (!record[header] && header !== "logoUrl" && header !== "description") {
        throw new Error(
          `Missing ${header} in scripts/instruments.csv at row ${rowIndex + 2}.`,
        );
      }
    }

    return {
      ticker: record.ticker,
      market: record.market,
      name: record.name,
      instrumentClass: record.instrumentClass,
      tradingCurrency: record.tradingCurrency,
      logoUrl:
        record.logoUrl === "NULL" || !record.logoUrl ? null : record.logoUrl,
      description:
        record.description === "NULL" || !record.description
          ? null
          : record.description,
    };
  });

  const tickers = new Set();
  for (const instrument of instruments) {
    const ticker = instrument.ticker.toUpperCase();
    if (tickers.has(ticker)) {
      throw new Error(
        `Duplicate instrument ticker in scripts/instruments.csv: ${ticker}.`,
      );
    }
    tickers.add(ticker);
  }

  if (instruments.length === 0) {
    throw new Error(
      "scripts/instruments.csv does not contain any instruments.",
    );
  }

  return instruments;
}

const INSTRUMENTS = readInstrumentCatalog();

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
  let lastError = null;

  for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(`${BACKEND_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      break;
    } catch (error) {
      lastError = error;
      const code = error?.cause?.code || error?.code || "";
      const isTransient =
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "EPIPE";

      if (!isTransient || attempt >= NETWORK_RETRY_ATTEMPTS) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, NETWORK_RETRY_DELAY_MS),
      );
    }
  }

  if (!response) {
    const cause =
      lastError?.cause?.code ||
      lastError?.cause?.message ||
      lastError?.message ||
      "unknown";
    throw new Error(
      `Unable to reach the backend at ${BACKEND_URL} while requesting ${method} ${path}: ${cause}. ` +
        "Start the backend with `docker compose up -d --build` or set BACKEND_URL to a reachable backend.",
      { cause: lastError || undefined },
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

function readEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function assertDevelopmentProvider() {
  const configured =
    process.env.IDENTITY_PROVIDER ?? readEnvFile().IDENTITY_PROVIDER;
  if (configured === "development") {
    return;
  }

  throw new Error(
    `This seed script requires IDENTITY_PROVIDER=development (current: ${configured || "unset"}). ` +
      "Set it in .env and recreate the backend before seeding.",
  );
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
      "exec",
      "-i",
      AUDITOR_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "jaakd",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
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
  try {
    await requestJson({
      method: "POST",
      path: "/api/auth/register",
      body: {
        email: user.email,
        password: user.password,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        dob: user.profile.dob ?? null,
        city: user.profile.city,
        state: user.profile.state,
        country: user.profile.country,
        zipCode: user.profile.zipCode,
      },
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
      const nickname = String(method.nickname || "")
        .trim()
        .toLowerCase();
      const bankName = String(method.bankName || "")
        .trim()
        .toLowerCase();
      const accountType = String(method.accountType || "")
        .trim()
        .toLowerCase();
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

async function ensureInstruments(cookie) {
  const instrumentsByTicker = new Map();

  for (const item of INSTRUMENTS) {
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
    path: `/api/portfolios/${portfolioId}/watchlists`,
    cookie,
    expectedStatuses: [200],
  });

  const existingWatchlists = Array.isArray(current.data) ? current.data : [];
  const watchlistByName = new Map(
    existingWatchlists.map((watchlist) => [
      String(watchlist.watchlistName),
      watchlist,
    ]),
  );

  let createdCount = 0;
  let createdItemsCount = 0;

  for (const definition of scenario.watchlists || []) {
    let watchlist = watchlistByName.get(definition.name);
    if (!watchlist) {
      const createdWatchlist = await requestJson({
        method: "POST",
        path: `/api/portfolios/${portfolioId}/watchlists`,
        cookie,
        body: {
          watchlistName: definition.name,
        },
        expectedStatuses: [201],
      });
      watchlist = createdWatchlist.data;
      watchlistByName.set(definition.name, watchlist);
      createdCount += 1;
    }

    const existingInstrumentIds = new Set(
      (Array.isArray(watchlist.items) ? watchlist.items : []).map((item) =>
        String(item.instrumentId),
      ),
    );

    for (const ticker of definition.symbols || []) {
      const instrument = instrumentsByTicker.get(ticker.toUpperCase());
      if (!instrument) {
        throw new Error(
          `Missing instrument ${ticker} while seeding watchlist.`,
        );
      }

      if (existingInstrumentIds.has(String(instrument.instrumentId))) {
        continue;
      }

      await requestJson({
        method: "POST",
        path: `/api/portfolios/${portfolioId}/watchlists/${watchlist.watchlistId}/items`,
        cookie,
        body: {
          instrumentId: instrument.instrumentId,
        },
        expectedStatuses: [201, 409],
      });

      createdItemsCount += 1;
    }
  }

  const refreshed = await requestJson({
    method: "GET",
    path: `/api/portfolios/${portfolioId}/watchlists`,
    cookie,
    expectedStatuses: [200],
  });

  const totalCount = Array.isArray(refreshed.data)
    ? refreshed.data.reduce(
        (sum, watchlist) =>
          sum + (Array.isArray(watchlist.items) ? watchlist.items.length : 0),
        0,
      )
    : 0;

  return {
    createdCount: createdItemsCount,
    createdWatchlists: createdCount,
    totalCount,
  };
}

async function seedOrders(
  ownerCookie,
  adminCookie,
  portfolioId,
  scenario,
  instrumentsByTicker,
) {
  const list = await requestJson({
    method: "GET",
    path: `/api/order-logs/portfolio/${portfolioId}`,
    cookie: ownerCookie,
    expectedStatuses: [200],
  });

  const existingLogs = Array.isArray(list.data) ? list.data : [];
  const existingLogsByMetadata = new Map(
    existingLogs
      .filter(
        (item) => typeof item.metadata === "string" && item.metadata.length > 0,
      )
      .map((item) => [item.metadata.split(" | ")[0], item]),
  );

  for (const event of scenario.orders) {
    if (event.quotedPrice === undefined) {
      continue;
    }

    const baseMetadata = `seed:${scenario.level}:${event.key}`;
    const existingRows = existingLogs.filter(
      (item) =>
        typeof item.metadata === "string" &&
        item.metadata.split(" | ")[0] === baseMetadata,
    );
    if (
      existingRows.some(
        (item) => (item.quotedPrice ?? null) !== event.quotedPrice,
      )
    ) {
      throw new Error(
        `Seeded order ${event.key} has a stale quotedPrice. Order logs cannot be updated in place; recreate the local demo data before rerunning the seed.`,
      );
    }
  }

  let submitted = 0;
  let skipped = 0;

  for (const [index, event] of scenario.orders.entries()) {
    const instrument = instrumentsByTicker.get(event.ticker.toUpperCase());

    if (!instrument) {
      throw new Error(
        `Missing instrument ${event.ticker} while seeding orders.`,
      );
    }

    const baseMetadata = `seed:${scenario.level}:${event.key}`;
    const finalStatus = event.status || "EXECUTED";
    const history = event.history || [];
    const statuses = [...history, finalStatus];
    const finalTimestamp =
      event.timestamp ||
      `2025-${String(Math.min(index + 1, 12)).padStart(2, "0")}-15T12:00:00`;
    const eventMetadata = statuses.map((_, eventIndex) =>
      eventIndex === statuses.length - 1
        ? baseMetadata
        : `${baseMetadata}:history:${eventIndex}`,
    );
    const existingRows = eventMetadata
      .map((metadata) => existingLogsByMetadata.get(metadata))
      .filter(Boolean);
    const orderId = existingRows[0]?.orderId || randomUUID();

    for (const [eventIndex, status] of statuses.entries()) {
      const metadata = eventMetadata[eventIndex];
      if (existingLogsByMetadata.has(metadata)) {
        skipped += 1;
        continue;
      }

      const isFinal = eventIndex === statuses.length - 1;
      const reasonMetadata =
        isFinal && event.reason
          ? ` | ${status === "REJECTED" ? "rejectionReason" : "failureReason"}=${event.reason}`
          : "";
      const minutesBeforeFinal = statuses.length - 1 - eventIndex;
      const timestamp =
        minutesBeforeFinal === 0
          ? finalTimestamp
          : new Date(
              new Date(`${finalTimestamp}Z`).getTime() -
                minutesBeforeFinal * 60_000,
            )
              .toISOString()
              .slice(0, 19);
      const payload = {
        orderId,
        portfolioId,
        instrumentId: instrument.instrumentId,
        side: event.side,
        quantity: event.quantity,
        metadata: `${metadata}${reasonMetadata}`,
        status,
        timestamp,
      };

      if (event.quotedPrice !== undefined) {
        payload.quotedPrice = event.quotedPrice;
      }

      if (status === "EXECUTED" && event.executionPrice !== undefined) {
        payload.executionPrice = event.executionPrice;
      }

      await requestJson({
        method: "POST",
        path: "/api/order-logs/demo",
        cookie: adminCookie,
        body: payload,
        expectedStatuses: [201],
      });

      existingLogsByMetadata.set(metadata, { orderId });
      submitted += 1;
    }
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

async function seedScenario(scenario, adminCookie, instrumentsByTicker) {
  const cookie = await registerAndLogin(scenario);
  await ensureProfile(cookie, scenario.profile);
  const paymentMethods = await ensurePaymentMethods(cookie, scenario);
  const portfolio = await ensurePortfolio(cookie, scenario.portfolioName);
  const watchlist = await ensureWatchlist(
    cookie,
    portfolio.portfolioId,
    scenario,
    instrumentsByTicker,
  );
  const orders = await seedOrders(
    cookie,
    adminCookie,
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
    watchlistsCreated: watchlist.createdWatchlists,
    paymentMethodsTotal: paymentMethods.totalCount,
    paymentMethodsCreated: paymentMethods.createdCount,
    paymentMethodsSkipped: paymentMethods.skippedCount,
    ordersSubmitted: orders.submitted,
    ordersSkipped: orders.skipped,
  };
}

function printCredentials() {
  console.log("Demo user credentials:");
  console.table([
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
  ]);
}

async function main() {
  assertDevelopmentProvider();
  console.log(`Seeding demo users using backend: ${BACKEND_URL}`);
  printCredentials();

  ensurePrivilegedAccount(AUDITOR_ACCOUNT);
  ensurePrivilegedAccount(ADMIN_ACCOUNT);
  console.log(`Auditor and admin accounts seeded in ${AUDITOR_CONTAINER}.`);
  const adminCookie = await registerAndLogin(ADMIN_ACCOUNT);
  const instrumentsByTicker = await ensureInstruments(adminCookie);
  console.log(`Ensured ${instrumentsByTicker.size} shared instruments.`);

  const summaries = [];

  for (const scenario of USERS) {
    console.log(`Seeding level: ${scenario.level}`);
    const summary = await seedScenario(
      scenario,
      adminCookie,
      instrumentsByTicker,
    );
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
      watchlistsCreated: item.watchlistsCreated,
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
