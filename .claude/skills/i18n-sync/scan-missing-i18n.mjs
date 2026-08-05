// Quét literal t("...") dạng "abc.def" trong src/pages + src/components, đối chiếu locale
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "D:/Capstone Website/SU26SE101-Capstone-Project-VietRide-Web";
const NS = ["common", "nav", "login", "admin", "manager"];
const locales = {};
for (const ns of NS) {
  locales[ns] = JSON.parse(readFileSync(join(ROOT, "src/i18n/locales/vi", ns + ".json"), "utf8"));
}

function has(obj, key) {
  let cur = obj;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) return false;
    cur = cur[part];
  }
  return typeof cur === "string" || (cur && typeof cur === "object"); // object = parent hit (dynamic sub-key) — treat as found
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, "src/pages")), ...walk(join(ROOT, "src/components"))];
// bắt t("a.b"), t('a.b'), t(`a.b`), tc("a.b"), i18nKey="a.b" — literal có dấu chấm
const callRe = /\b(?:t|tc|tn|tm|tl|ta)\(\s*(["'`])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g;
const missing = new Map();

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = file.replaceAll("\\", "/").slice(ROOT.length + 1);
  const isAdmin = rel.includes("pages/Admin/");
  const isManager = rel.includes("pages/Manager/");
  let m;
  while ((m = callRe.exec(src))) {
    const key = m[2];
    let namespaces;
    if (isAdmin) namespaces = ["admin", "common", "nav", "login"];
    else if (isManager) namespaces = ["manager", "common", "nav", "login"];
    else namespaces = NS;
    const found = namespaces.some((ns) => has(locales[ns], key));
    if (!found) {
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key).add(rel);
    }
  }
}

if (!missing.size) console.log("OK — no missing literal keys found");
for (const [key, filesSet] of [...missing.entries()].sort()) {
  console.log(key, "->", [...filesSet].join(", "));
}
