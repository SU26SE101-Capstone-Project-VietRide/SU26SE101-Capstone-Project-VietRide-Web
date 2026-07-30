import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const DEFAULT_CONFIG = Object.freeze({
  staff: 10,
  drivers: 8,
  assistants: 6,
  emailPrefix: "seed",
  emailDomain: "vietride.test",
});

const PRODUCTION_HOSTS = new Set(["api.vietride.online"]);

const roleDefinitions = [
  {
    countKey: "staff",
    emailSegment: "staff",
    namePrefix: "Nhân viên vận hành",
    phoneOffset: 1000,
    role: "OPERATOR_STAFF",
  },
  {
    countKey: "drivers",
    emailSegment: "driver",
    namePrefix: "Tài xế",
    phoneOffset: 2000,
    role: "DRIVER",
  },
  {
    countKey: "assistants",
    emailSegment: "assistant",
    namePrefix: "Phụ xe",
    phoneOffset: 3000,
    role: "ASSISTANT",
  },
];

const vietnameseNames = [
  "Nguyễn Minh Anh",
  "Trần Quốc Bảo",
  "Lê Hoàng Duy",
  "Phạm Gia Hân",
  "Hoàng Đức Long",
  "Võ Ngọc Mai",
  "Đặng Thanh Nam",
  "Bùi Khánh Ngân",
  "Đỗ Quang Phúc",
  "Hồ Thảo Vy",
  "Nguyễn Tuấn Kiệt",
  "Trần Hải Yến",
  "Lê Thành Công",
  "Phạm Bảo Châu",
  "Hoàng Nhật Minh",
  "Võ Thu Trang",
  "Đặng Anh Tuấn",
  "Bùi Mỹ Linh",
  "Đỗ Trung Hiếu",
  "Hồ Kim Oanh",
  "Nguyễn Hữu Đạt",
  "Trần Phương Nhi",
  "Lê Xuân Trường",
  "Phạm Ngọc Diệp",
];

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function parseCount(name, value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  const count = Number(value);
  if (!Number.isSafeInteger(count) || count > 100) {
    throw new Error(`${name} must be between 0 and 100.`);
  }

  return count;
}

function readValueArgument(argument, name) {
  const prefix = `--${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : null;
}

export function parseArgs(argv) {
  const config = {
    ...DEFAULT_CONFIG,
    apply: false,
    allowProduction: false,
    help: false,
  };

  for (const argument of argv) {
    if (argument === "--apply") {
      config.apply = true;
      continue;
    }

    if (argument === "--allow-production") {
      config.allowProduction = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      config.help = true;
      continue;
    }

    const staff = readValueArgument(argument, "staff");
    if (staff !== null) {
      config.staff = parseCount("staff", staff);
      continue;
    }

    const drivers = readValueArgument(argument, "drivers");
    if (drivers !== null) {
      config.drivers = parseCount("drivers", drivers);
      continue;
    }

    const assistants = readValueArgument(argument, "assistants");
    if (assistants !== null) {
      config.assistants = parseCount("assistants", assistants);
      continue;
    }

    const emailPrefix = readValueArgument(argument, "email-prefix");
    if (emailPrefix !== null) {
      config.emailPrefix = emailPrefix;
      continue;
    }

    const emailDomain = readValueArgument(argument, "email-domain");
    if (emailDomain !== null) {
      config.emailDomain = emailDomain;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  validateEmailPart("email-prefix", config.emailPrefix);
  validateEmailDomain(config.emailDomain);
  return config;
}

function validateEmailPart(name, value) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`${name} contains unsupported characters.`);
  }
}

function validateEmailDomain(value) {
  if (
    value.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value) ||
    !value.includes(".")
  ) {
    throw new Error("email-domain must be a valid domain.");
  }
}

function buildPhoneNumber(offset, index) {
  return `+8491${String(offset + index).padStart(7, "0")}`;
}

export function buildSeedUsers(config = DEFAULT_CONFIG) {
  validateEmailPart("email-prefix", config.emailPrefix);
  validateEmailDomain(config.emailDomain);

  const users = [];
  let nameIndex = 0;

  for (const definition of roleDefinitions) {
    const count = config[definition.countKey];

    for (let index = 1; index <= count; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const personalName =
        vietnameseNames[nameIndex % vietnameseNames.length];

      users.push({
        displayName: `${definition.namePrefix} ${suffix} - ${personalName}`,
        email:
          `${config.emailPrefix}.${definition.emailSegment}.${suffix}` +
          `@${config.emailDomain}`,
        phone: buildPhoneNumber(definition.phoneOffset, index),
        role: definition.role,
      });
      nameIndex += 1;
    }
  }

  return users;
}

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function isProductionUrl(value) {
  return PRODUCTION_HOSTS.has(new URL(value).hostname.toLowerCase());
}

function unwrapData(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return payload.data;
  }

  return payload;
}

function errorDetails(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const error =
    payload.error && typeof payload.error === "object" ? payload.error : {};

  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message:
      typeof error.message === "string"
        ? error.message
        : typeof payload.message === "string"
          ? payload.message
          : undefined,
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError("Server returned invalid JSON.", response.status);
    }
  }

  if (!response.ok) {
    const details = errorDetails(payload);
    throw new ApiError(
      details.message || `Request failed with status ${response.status}.`,
      response.status,
      details.code,
    );
  }

  return unwrapData(payload);
}

async function resolveAccessToken(baseUrl) {
  const configuredToken = process.env.VIETRIDE_SEED_ACCESS_TOKEN?.trim();
  if (configuredToken) {
    return configuredToken;
  }

  const email = process.env.VIETRIDE_SEED_ADMIN_EMAIL?.trim();
  const password = process.env.VIETRIDE_SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Apply mode requires VIETRIDE_SEED_ACCESS_TOKEN or both " +
        "VIETRIDE_SEED_ADMIN_EMAIL and VIETRIDE_SEED_ADMIN_PASSWORD.",
    );
  }

  const loginData = await requestJson(baseUrl, "/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (
    !loginData ||
    typeof loginData !== "object" ||
    typeof loginData.accessToken !== "string"
  ) {
    throw new Error("Login response does not contain an access token.");
  }

  if (loginData.user?.role !== "OPERATOR_ADMIN") {
    throw new Error("Seed login must belong to an OPERATOR_ADMIN account.");
  }

  return loginData.accessToken;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function loadExistingEmails(baseUrl, accessToken, emailPrefix) {
  const emails = new Set();
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 20) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "100",
      search: `${emailPrefix}.`,
    });
    const data = await requestJson(
      baseUrl,
      `/v1/operator/users?${query.toString()}`,
      { headers: authHeaders(accessToken) },
    );
    const items = Array.isArray(data) ? data : data?.items;

    if (!Array.isArray(items)) {
      throw new Error("Operator users response does not contain an items array.");
    }

    for (const item of items) {
      if (item && typeof item.email === "string") {
        emails.add(item.email.toLowerCase());
      }
    }

    hasNextPage = Array.isArray(data) ? false : data?.hasNextPage === true;
    page += 1;
  }

  return emails;
}

async function createUser(baseUrl, accessToken, user) {
  return requestJson(baseUrl, "/v1/operator/users", {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(user),
  });
}

function printPlan(baseUrl, users, apply) {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`API: ${baseUrl}`);
  console.log(`Users: ${users.length}`);
  console.table(
    users.map(({ displayName, email, phone, role }) => ({
      role,
      displayName,
      email,
      phone,
    })),
  );
}

function printHelp() {
  console.log(`
Seed VietRide operator users through the existing public API.

Usage:
  npm run seed:operator-users
  npm run seed:operator-users -- --apply [options]

Options:
  --staff=N              OPERATOR_STAFF count (default 10)
  --drivers=N            DRIVER count (default 8)
  --assistants=N         ASSISTANT count (default 6)
  --email-prefix=VALUE   deterministic email prefix (default seed)
  --email-domain=DOMAIN  test email domain (default vietride.test)
  --apply                create accounts; otherwise only print the plan
  --allow-production     required with --apply for api.vietride.online
  --help                 show this message

Environment:
  VIETRIDE_SEED_API_BASE_URL
  VIETRIDE_SEED_ACCESS_TOKEN
  VIETRIDE_SEED_ADMIN_EMAIL
  VIETRIDE_SEED_ADMIN_PASSWORD
`);
}

export async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(
    process.env.VIETRIDE_SEED_API_BASE_URL || "http://localhost:3000",
  );
  const users = buildSeedUsers(config);
  printPlan(baseUrl, users, config.apply);

  if (!config.apply) {
    console.log("No accounts were created. Add --apply to write seed data.");
    return;
  }

  if (isProductionUrl(baseUrl) && !config.allowProduction) {
    throw new Error(
      "Production seeding is blocked. Verify the target and pass " +
        "--allow-production only when this write is intentional.",
    );
  }

  const accessToken = await resolveAccessToken(baseUrl);
  const existingEmails = await loadExistingEmails(
    baseUrl,
    accessToken,
    config.emailPrefix,
  );
  const summary = { created: 0, skipped: 0, failed: 0 };

  for (const user of users) {
    if (existingEmails.has(user.email.toLowerCase())) {
      summary.skipped += 1;
      console.log(`SKIP ${user.email} (already exists)`);
      continue;
    }

    try {
      await createUser(baseUrl, accessToken, user);
      existingEmails.add(user.email.toLowerCase());
      summary.created += 1;
      console.log(`CREATE ${user.email}`);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        ["EMAIL_ALREADY_EXISTS", "USER_ALREADY_EXISTS"].includes(error.code)
      ) {
        summary.skipped += 1;
        console.log(`SKIP ${user.email} (${error.code})`);
        continue;
      }

      summary.failed += 1;
      console.error(
        `FAIL ${user.email}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `Done: ${summary.created} created, ${summary.skipped} skipped, ` +
      `${summary.failed} failed.`,
  );
  console.log(
    "New users must set their initial password through the email flow.",
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

const isExecutedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
