const fs = require("node:fs");

const filePath = "src/pages/Admin/Vouchers.tsx";
let source = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

function replaceExact(before, after) {
  if (!source.includes(before)) {
    throw new Error(`Missing expected voucher table source: ${before.slice(0, 120)}`);
  }
  source = source.replace(before, after);
}

replaceExact(
  `          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-gray-200 bg-gray-50">`,
  `          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full table-fixed text-sm [&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap [&_th]:px-2">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[14%]" />
                <col className="w-[7%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50">`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono font-semibold text-vr-600">
                          {voucher.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{voucher.name}</p>
                        <p className="text-xs text-gray-500">
                          {voucher.description}
                        </p>
                      </td>`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        <span
                          className="block truncate font-mono font-semibold text-vr-600"
                          title={voucher.code}
                        >
                          {voucher.code}
                        </span>
                      </td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        <p
                          className="truncate font-medium text-gray-900"
                          title={voucher.name}
                        >
                          {voucher.name}
                        </p>
                        <p
                          className="truncate text-xs text-gray-500"
                          title={voucher.description}
                        >
                          {voucher.description}
                        </p>
                      </td>`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-lg font-bold text-gray-900">`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        <span className="block truncate text-base font-bold text-gray-900">`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {getApplicableLabel(applicableToOf(voucher))}
                        </span>
                      </td>`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        <span
                          className="block truncate text-sm text-gray-600"
                          title={getApplicableLabel(applicableToOf(voucher))}
                        >
                          {getApplicableLabel(applicableToOf(voucher))}
                        </span>
                      </td>`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {getFundingLabel(voucher.fundingType)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getOperatorScopeLabel(voucher)}
                        </p>
                      </td>`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        <p
                          className="truncate text-sm font-medium text-gray-900"
                          title={getFundingLabel(voucher.fundingType)}
                        >
                          {getFundingLabel(voucher.fundingType)}
                        </p>
                        <p
                          className="truncate text-xs text-gray-500"
                          title={getOperatorScopeLabel(voucher)}
                        >
                          {getOperatorScopeLabel(voucher)}
                        </p>
                      </td>`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        {formatNumber(quantity)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">
                        {formatNumber(quantity)}
                      </td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">`,
);

replaceExact(
  `                        <div className="w-20">`,
  `                        <div className="w-full max-w-20">`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {expiryDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">`,
  `                      <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-sm">
                        <span className="block truncate" title={expiryDate}>
                          {expiryDate}
                        </span>
                      </td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4">`,
);

replaceExact(
  `                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex justify-end gap-2">`,
  `                      <td className="whitespace-nowrap px-2 py-4">
                        <div className="flex justify-end gap-1">`,
);

source = source.replaceAll(
  `className="inline-flex h-9 w-9 items-center justify-center rounded-lg`,
  `className="inline-flex h-8 w-8 items-center justify-center rounded-lg`,
);

fs.writeFileSync(filePath, source);
