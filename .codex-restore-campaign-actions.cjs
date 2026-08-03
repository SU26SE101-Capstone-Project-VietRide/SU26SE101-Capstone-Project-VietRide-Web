const fs = require("node:fs");

const filePath = "src/pages/Admin/Vouchers.tsx";
let source = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

for (const suffix of [
  "border border-gray-200 text-gray-600 hover:bg-gray-50",
  "border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50",
]) {
  const before = `onClick=${suffix.includes("disabled") ? "() => void handleToggleCampaign(campaign)" : "() => openEditCampaignModal(campaign)"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg ${suffix}"`;
  const after = before.replace("h-8 w-8", "h-9 w-9");
  if (!source.includes(before)) {
    throw new Error("Missing expected campaign action source");
  }
  source = source.replace(before, after);
}

fs.writeFileSync(filePath, source);
