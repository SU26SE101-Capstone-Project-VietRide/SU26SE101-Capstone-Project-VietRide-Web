const fs = require("node:fs");

const filePath = "src/pages/Admin/Vouchers.tsx";
let source = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

const replacements = [
  [
    `onClick={() => openEditCampaignModal(campaign)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"`,
    `onClick={() => openEditCampaignModal(campaign)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"`,
  ],
  [
    `onClick={() => void handleToggleCampaign(campaign)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"`,
    `onClick={() => void handleToggleCampaign(campaign)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"`,
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    throw new Error("Missing expected campaign action source");
  }
  source = source.replace(before, after);
}

fs.writeFileSync(filePath, source);
