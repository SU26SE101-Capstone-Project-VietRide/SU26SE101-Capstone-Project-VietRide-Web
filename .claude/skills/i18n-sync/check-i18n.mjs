#!/usr/bin/env node
// Kiểm tra parity key giữa src/i18n/locales/vi và /en cho cả 5 namespace.
// Exit 1 khi có key lệch — dùng được cả thủ công lẫn trong hook/CI.
//
// Cách chạy (từ repo root):
//   node .claude/skills/i18n-sync/check-i18n.mjs
//   node .claude/skills/i18n-sync/check-i18n.mjs --json

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Giữ khớp với ns[] trong src/i18n/index.ts.
const NAMESPACES = ["common", "nav", "login", "admin", "manager"];
const LOCALES_DIR = resolve(process.cwd(), "src/i18n/locales");

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? flatten(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function loadKeys(locale, namespace) {
  const path = resolve(LOCALES_DIR, locale, `${namespace}.json`);
  return flatten(JSON.parse(readFileSync(path, "utf8")));
}

const asJson = process.argv.includes("--json");
const report = [];
let failed = false;

for (const namespace of NAMESPACES) {
  const vi = loadKeys("vi", namespace);
  const en = loadKeys("en", namespace);
  const missingInEn = vi.filter((key) => !en.includes(key));
  const missingInVi = en.filter((key) => !vi.includes(key));
  const duplicateGuard = vi.length !== new Set(vi).size;

  if (missingInEn.length || missingInVi.length || duplicateGuard) failed = true;

  report.push({ namespace, viCount: vi.length, enCount: en.length, missingInEn, missingInVi });
}

if (asJson) {
  console.log(JSON.stringify({ ok: !failed, report }, null, 2));
} else {
  for (const row of report) {
    const status = row.missingInEn.length || row.missingInVi.length ? "FAIL" : "ok  ";
    console.log(
      `${status} ${row.namespace.padEnd(8)} vi=${String(row.viCount).padStart(4)} en=${String(row.enCount).padStart(4)}`,
    );
    if (row.missingInEn.length) console.log(`     thiếu trong en: ${row.missingInEn.join(", ")}`);
    if (row.missingInVi.length) console.log(`     thiếu trong vi: ${row.missingInVi.join(", ")}`);
  }
  console.log(failed ? "\nKey lệch giữa vi và en — bổ sung trước khi commit." : "\nParity vi/en OK.");
}

process.exit(failed ? 1 : 0);
