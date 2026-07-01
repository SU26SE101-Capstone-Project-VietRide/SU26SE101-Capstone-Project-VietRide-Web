import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEye } from "react-icons/fi";
import Modal from "../../components/Modal";

type PayoutBatch = {
  id: string;
  cycle: string;
  operator: string;
  trips: number;
  gross: number;
  commission: number;
  net: number;
  status: "pending" | "approved" | "transferred" | "rejected";
};

const STATUS_CLASS: Record<PayoutBatch["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  approved: "bg-green-100 text-green-700",
  transferred: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-600",
};

const INITIAL_BATCHES: PayoutBatch[] = [
  {
    id: "PO-2025-05-W3",
    cycle: "12/05 → 18/05/2025",
    operator: "Phương Trang",
    trips: 412,
    gross: 1842.5,
    commission: 184.2,
    net: 1658.3,
    status: "pending",
  },
  {
    id: "PO-2025-05-W3-FUTA",
    cycle: "12/05 → 18/05/2025",
    operator: "Futa Bus Lines",
    trips: 528,
    gross: 2210.8,
    commission: 221.1,
    net: 1989.7,
    status: "pending",
  },
  {
    id: "PO-2025-05-W3-TB",
    cycle: "12/05 → 18/05/2025",
    operator: "Thành Bưởi",
    trips: 286,
    gross: 1124.2,
    commission: 112.4,
    net: 1011.8,
    status: "approved",
  },
  {
    id: "PO-2025-05-W2-HL",
    cycle: "05/05 → 11/05/2025",
    operator: "Hoàng Long",
    trips: 198,
    gross: 812.4,
    commission: 81.2,
    net: 731.2,
    status: "transferred",
  },
  {
    id: "PO-2025-05-W2-ML",
    cycle: "05/05 → 11/05/2025",
    operator: "Mai Linh Express",
    trips: 142,
    gross: 528.1,
    commission: 52.8,
    net: 475.3,
    status: "rejected",
  },
];

export default function Payouts() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [batches, setBatches] = useState<PayoutBatch[]>(INITIAL_BATCHES);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const getStatusLabel = (status: PayoutBatch["status"]) => {
    const map: Record<PayoutBatch["status"], string> = {
      pending: tc("pending"),
      approved: tc("approved"),
      transferred: t("payouts.transferred"),
      rejected: t("payouts.reject"),
    };
    return map[status];
  };

  const filtered = batches.filter(
    (b) =>
      b.operator.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase()),
  );

  function openBatch(i: number) {
    setSelectedIdx(i);
  }

  function closeBatch() {
    setSelectedIdx(null);
  }

  function updateStatus(i: number, status: PayoutBatch["status"]) {
    setBatches((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, status } : b)),
    );
    closeBatch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("payouts.title")}{" "}
            <span className="ml-2 inline-block rounded-full bg-gray-100 text-xs px-2 py-1 text-gray-600 font-normal">
              {tc("adminBadge")}
            </span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("payouts.subtitleLong")}
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {tc("exportReport")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {tc("pending")}
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {t("payouts.pendingBatches", { count: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("payouts.pendingAmount", { amount: "3648.0" })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">
            {t("payouts.approvedThisWeek")}
          </p>
          <p className="text-2xl font-bold text-green-600">đ1743.0 tỷ</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">
            {t("payouts.platformCommission")}
          </p>
          <p className="text-2xl font-bold text-gray-900">đ651.7 tỷ</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">
            {t("payouts.totalTrips")}
          </p>
          <p className="text-2xl font-bold text-gray-900">1,566</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("payouts.searchPlaceholder")}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            {tc("filter")}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
            {tc("columns")}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {tc("exportCsv")}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">
                  {t("payouts.batchId")}
                </th>
                <th className="px-4 py-3 font-medium">{t("payouts.cycle")}</th>
                <th className="px-4 py-3 font-medium">
                  {t("payouts.operator")}
                </th>
                <th className="px-4 py-3 font-medium">{t("payouts.trips")}</th>
                <th className="px-4 py-3 font-medium">{t("payouts.gross")}</th>
                <th className="px-4 py-3 font-medium">
                  {t("payouts.commission")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("payouts.netPayout")}
                </th>
                <th className="px-4 py-3 font-medium">{tc("status")}</th>
                <th className="px-4 py-3 font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const realIdx = batches.indexOf(b);
                return (
                  <tr
                    key={b.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {b.id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.cycle}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {b.operator}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.trips}</td>
                    <td className="px-4 py-3 text-gray-700">
                      đ{b.gross.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      đ{b.commission.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      đ{b.net.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[b.status]}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {getStatusLabel(b.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openBatch(realIdx)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
                        title={tc("details")}
                        aria-label={tc("details")}
                      >
                        <FiEye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            {tc("showingItems", {
              count: filtered.length,
              total: batches.length,
            })}
          </div>
          <div className="flex items-center gap-1">
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">
              {tc("previous")}
            </button>
            <button className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm">
              1
            </button>
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">
              2
            </button>
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">
              3
            </button>
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50">
              {tc("next")}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={selectedIdx !== null}
        onClose={closeBatch}
        title={
          selectedIdx !== null
            ? batches[selectedIdx].id
            : t("payouts.detailTitle")
        }
        subtitle={
          selectedIdx !== null ? batches[selectedIdx].operator : undefined
        }
        wide
      >
        {selectedIdx !== null && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">{t("payouts.cycle")}</p>
                <p className="text-sm font-medium mt-0.5">
                  {batches[selectedIdx].cycle}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">
                  {t("payouts.tripCount")}
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {batches[selectedIdx].trips}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">
                  {t("payouts.grossLabel")}
                </p>
                <p className="text-sm font-medium mt-0.5">
                  đ{batches[selectedIdx].gross.toLocaleString("vi-VN")}
                  {t("payouts.billion")}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">
                  {t("payouts.commission")}
                </p>
                <p className="text-sm font-medium mt-0.5">
                  đ{batches[selectedIdx].commission.toLocaleString("vi-VN")}
                  {t("payouts.billion")}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3 col-span-2">
                <p className="text-xs text-gray-500">
                  {t("payouts.netPayout")}
                </p>
                <p className="text-lg font-bold mt-0.5">
                  đ{batches[selectedIdx].net.toLocaleString("vi-VN")}
                  {t("payouts.billion")}
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[batches[selectedIdx].status]}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {getStatusLabel(batches[selectedIdx].status)}
              </span>
            </div>
            <div className="mt-4 flex gap-2 border-t pt-4">
              <button
                onClick={() => updateStatus(selectedIdx, "approved")}
                className="px-4 py-2 bg-gray-900 text-white rounded text-sm hover:bg-gray-800"
              >
                {t("payouts.approve")}
              </button>
              <button
                onClick={() => updateStatus(selectedIdx, "transferred")}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                {t("payouts.transfer")}
              </button>
              <button
                onClick={() => updateStatus(selectedIdx, "rejected")}
                className="px-4 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("payouts.reject")}
              </button>
              <button
                onClick={closeBatch}
                className="ml-auto px-4 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                {tc("close")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
