import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiEye,
  FiFilter,
  FiImage,
  FiList,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  parcels as mockParcels,
  tripCargoLoads,
  type Parcel,
} from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";
const actionIconClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

type ExtraLargeParcelStatus = "pending" | "approved" | "rejected";

type ExtraLargeParcelReview = {
  id: string;
  code: string;
  sender: string;
  recipient: string;
  trip: string;
  route: string;
  declaredWeightKg: number;
  dimensionsCm: string;
  declaredValue: number;
  capacityRemainingKg: number;
  requestedAt: string;
  images: number;
  status: ExtraLargeParcelStatus;
  manualFee?: number;
  decisionReason?: string;
};

const initialReviewQueue: ExtraLargeParcelReview[] = [
  {
    id: "xl-001",
    code: "VRP-XL-2401",
    sender: "Cty Minh Phat",
    recipient: "Nguyen Bao Tran",
    trip: "VR-2401",
    route: "TP.HCM - Da Lat",
    declaredWeightKg: 68,
    dimensionsCm: "140 x 70 x 65",
    declaredValue: 8_500_000,
    capacityRemainingKg: 82,
    requestedAt: "2026-07-01 09:20",
    images: 3,
    status: "pending",
  },
  {
    id: "xl-002",
    code: "VRP-XL-2402",
    sender: "Le Gia Furniture",
    recipient: "Tran Minh Quan",
    trip: "VR-2403",
    route: "TP.HCM - Nha Trang",
    declaredWeightKg: 95,
    dimensionsCm: "180 x 80 x 90",
    declaredValue: 12_000_000,
    capacityRemainingKg: 60,
    requestedAt: "2026-07-01 10:05",
    images: 2,
    status: "pending",
  },
  {
    id: "xl-003",
    code: "VRP-XL-2403",
    sender: "Hoang Lam",
    recipient: "Pham Nhu Y",
    trip: "VR-2408",
    route: "Can Tho - TP.HCM",
    declaredWeightKg: 52,
    dimensionsCm: "100 x 50 x 45",
    declaredValue: 4_200_000,
    capacityRemainingKg: 110,
    requestedAt: "2026-06-30 16:40",
    images: 1,
    status: "approved",
    manualFee: 180_000,
    decisionReason: "Capacity available.",
  },
];

function parcelStatusBadge(
  s: Parcel["status"],
  t: (key: string) => string,
) {
  if (s === "in_transit")
    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
        {t("parcels.inTransit")}
      </span>
    );
  if (s === "delivered")
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        {t("parcels.delivered")}
      </span>
    );
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      {t("parcels.waitingPickup")}
    </span>
  );
}

function cargoBarColor(pct: number) {
  if (pct >= 0.94) return "bg-red-500";
  if (pct >= 0.75) return "bg-amber-500";
  return "bg-emerald-500";
}

function reviewStatusBadge(
  status: ExtraLargeParcelStatus,
  t: (key: string) => string,
) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <FiCheckCircle size={13} />
        {t("parcels.reviewStatusApproved")}
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        <FiXCircle size={13} />
        {t("parcels.reviewStatusRejected")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      <FiAlertCircle size={13} />
      {t("parcels.reviewStatusPending")}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function ParcelsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [searchTerm, setSearchTerm] = useState("");
  const [reviewQueue, setReviewQueue] = useState(initialReviewQueue);
  const [selectedReviewId, setSelectedReviewId] = useState(
    initialReviewQueue[0]?.id ?? "",
  );
  const [manualFee, setManualFee] = useState("220000");
  const [decisionReason, setDecisionReason] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [consignOpen, setConsignOpen] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openDelivery, setOpenDelivery] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

  const filtered = useMemo(
    () =>
      mockParcels.filter(
        (p) =>
          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.recipient.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );
  const selectedReview =
    reviewQueue.find((item) => item.id === selectedReviewId) ??
    reviewQueue[0] ??
    null;
  const pendingReviewCount = reviewQueue.filter(
    (item) => item.status === "pending",
  ).length;

  function openReview(review: ExtraLargeParcelReview) {
    setSelectedReviewId(review.id);
    setManualFee(review.manualFee ? String(review.manualFee) : "220000");
    setDecisionReason(review.decisionReason ?? "");
    setReviewMessage("");
    setReviewError("");
  }

  function updateReview(
    review: ExtraLargeParcelReview,
    patch: Pick<
      ExtraLargeParcelReview,
      "status" | "manualFee" | "decisionReason"
    >,
  ) {
    setReviewQueue((current) =>
      current.map((item) =>
        item.id === review.id ? { ...item, ...patch } : item,
      ),
    );
  }

  function handleApproveReview() {
    if (!selectedReview) return;
    setReviewMessage("");
    setReviewError("");

    if (selectedReview.status !== "pending") {
      setReviewError(t("parcels.reviewAlreadyProcessed"));
      return;
    }

    const fee = Number(manualFee);
    if (!Number.isFinite(fee) || fee <= 0) {
      setReviewError(t("parcels.reviewInvalidFee"));
      return;
    }

    if (selectedReview.declaredWeightKg > selectedReview.capacityRemainingKg) {
      setReviewError(t("parcels.reviewInsufficientCapacity"));
      return;
    }

    updateReview(selectedReview, {
      status: "approved",
      manualFee: fee,
      decisionReason: decisionReason.trim() || t("parcels.reviewApproved"),
    });
    setReviewMessage(t("parcels.reviewApproveSuccess"));
  }

  function handleRejectReview() {
    if (!selectedReview) return;
    setReviewMessage("");
    setReviewError("");

    if (selectedReview.status !== "pending") {
      setReviewError(t("parcels.reviewAlreadyProcessed"));
      return;
    }

    if (!decisionReason.trim()) {
      setReviewError(t("parcels.reviewReasonRequired"));
      return;
    }

    updateReview(selectedReview, {
      status: "rejected",
      manualFee: undefined,
      decisionReason: decisionReason.trim(),
    });
    setReviewMessage(t("parcels.reviewRejectSuccess"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("parcels.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("parcels.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConsignOpen(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("parcels.create")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("parcels.todayOrders")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">342</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                ↘ 2.3%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiPackage size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("parcels.inTransit")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">142</p>
              <p className="mt-2 text-xs text-gray-500">
                {t("parcels.onTrips", { count: 28 })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTruck size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("parcels.delivered")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">188</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 14%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiCheckCircle size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("parcels.needsAction")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {pendingReviewCount}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {t("parcels.extraLargePending")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiAlertCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("parcels.reviewTitle")}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-500">
                {t("parcels.reviewSubtitle")}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <FiAlertCircle size={14} />
              {t("parcels.pendingReviews", { count: pendingReviewCount })}
            </span>
          </div>
        </div>

        {reviewMessage && (
          <div className="mx-5 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {reviewMessage}
          </div>
        )}
        {reviewError && (
          <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {reviewError}
          </div>
        )}

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">{t("parcels.orderCode")}</th>
                  <th className="px-4 py-3">{t("parcels.parcelDetails")}</th>
                  <th className="px-4 py-3">{t("parcels.requestedTrip")}</th>
                  <th className="px-4 py-3">{t("parcels.capacity")}</th>
                  <th className="px-4 py-3">{tc("status")}</th>
                  <th className="px-4 py-3 text-right">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map((review) => (
                  <tr
                    key={review.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 ${
                      selectedReview?.id === review.id ? "bg-vr-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{review.code}</p>
                      <p className="text-xs text-gray-500">{review.requestedAt}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      <p>
                        {review.declaredWeightKg}kg · {review.dimensionsCm}
                      </p>
                      <p className="text-xs text-gray-500">
                        {review.sender} → {review.recipient}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{review.trip}</p>
                      <p className="text-xs text-gray-500">{review.route}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {review.capacityRemainingKg}kg
                    </td>
                    <td className="px-4 py-4">
                      {reviewStatusBadge(review.status, t)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => openReview(review)}
                          className={actionIconClass}
                          title={t("parcels.reviewOpen")}
                          aria-label={t("parcels.reviewOpen")}
                        >
                          <FiEye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            {selectedReview ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("parcels.reviewSelected")}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900">
                    {selectedReview.code}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedReview.route}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label={t("parcels.weightKg")} value={`${selectedReview.declaredWeightKg} kg`} />
                  <Info label={t("parcels.dimensions")} value={selectedReview.dimensionsCm} />
                  <Info
                    label={t("parcels.declaredValue")}
                    value={`${selectedReview.declaredValue.toLocaleString("vi-VN")}đ`}
                  />
                  <Info
                    label={t("parcels.images")}
                    value={t("parcels.imageCount", { count: selectedReview.images })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: selectedReview.images }).map((_, index) => (
                    <div
                      key={`${selectedReview.id}-${index}`}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-gray-400"
                    >
                      <FiImage size={20} />
                    </div>
                  ))}
                </div>

                <div>
                  <label className={labelClass}>{t("parcels.manualFee")}</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={manualFee}
                    onChange={(event) => setManualFee(event.target.value)}
                    disabled={selectedReview.status !== "pending"}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("parcels.decisionReason")}</label>
                  <textarea
                    className={inputClass + " min-h-[92px]"}
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    placeholder={t("parcels.decisionReasonPlaceholder")}
                    rows={3}
                    disabled={selectedReview.status !== "pending"}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApproveReview}
                    disabled={selectedReview.status !== "pending"}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiCheckCircle />
                    {t("parcels.approve")}
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectReview}
                    disabled={selectedReview.status !== "pending"}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiXCircle />
                    {t("parcels.reject")}
                  </button>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {t("parcels.reviewPaymentRule")}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t("parcels.reviewEmpty")}</p>
            )}
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("parcels.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={inputClass + " pl-10"}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={actionIconClass}
                  title={tc("filter")}
                  aria-label={tc("filter")}
                >
                  <FiFilter size={16} />
                </button>
                <button
                  type="button"
                  className={actionIconClass}
                  title={tc("columns")}
                  aria-label={tc("columns")}
                >
                  <FiList size={16} />
                </button>
                <button
                  type="button"
                  className={actionIconClass}
                  title={tc("exportCsv")}
                  aria-label={tc("exportCsv")}
                >
                  <FiDownload size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">{t("parcels.orderCode")}</th>
                  <th className="px-5 py-3">{t("parcels.sender")}</th>
                  <th className="px-5 py-3">{t("parcels.route")}</th>
                  <th className="px-5 py-3">{t("parcels.weight")}</th>
                  <th className="px-5 py-3">{t("parcels.fee")}</th>
                  <th className="px-5 py-3">{tc("status")}</th>
                  <th className="px-5 py-3">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {p.code}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-semibold text-gray-900">{p.sender}</p>
                      <p className="text-xs text-gray-500">{p.senderContact}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {p.route}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {p.weightKg} kg
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {p.fee.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-5 py-4">
                      {parcelStatusBadge(p.status, t)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedParcel(p);
                          setOpenDetail(true);
                        }}
                        className={actionIconClass}
                        title={tc("details")}
                        aria-label={tc("details")}
                      >
                        <FiEye size={16} />
                      </button>
                      {p.status === "in_transit" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedParcel(p);
                            setOpenDelivery(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          title={t("parcels.confirmDelivery")}
                          aria-label={t("parcels.confirmDelivery")}
                        >
                          <FiCheckCircle size={16} />
                        </button>
                      )}
                      {p.status !== "delivered" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t("parcels.confirmCancel"))) {
                              alert(t("parcels.cancelSuccess"));
                            }
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          title={tc("cancel")}
                          aria-label={tc("cancel")}
                        >
                          <FiXCircle size={16} />
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {tc("showingItems", { count: filtered.length, total: 342 })}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                {tc("previous")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-vr-500 px-3 py-1.5 text-sm font-semibold text-slate-900"
              >
                1
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                2
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                3
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                {tc("next")}
              </button>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">
            {t("parcels.cargoCapacity")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">{tc("today")}</p>
          <ul className="mt-4 space-y-4">
            {tripCargoLoads.map((trip) => {
              const pct = trip.currentKg / trip.maxKg;
              return (
                <li key={trip.tripCode}>
                  <p className="text-xs font-medium text-gray-800">
                    {trip.label}
                  </p>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>
                      {trip.currentKg}/{trip.maxKg}kg
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${cargoBarColor(pct)}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <Modal
        open={consignOpen}
        onClose={() => setConsignOpen(false)}
        wide
        icon={<FiPackage size={20} />}
        title={t("parcels.createTitle")}
        subtitle={t("parcels.createSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConsignOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => setConsignOpen(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("parcels.createAndPrint")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("parcels.sender")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("parcels.fullNameCompany")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="Cty Minh Phát" />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="0901 234 567" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("parcels.pickupAddress")}
                </label>
                <textarea className={inputClass + " min-h-[72px]"} rows={2} />
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("parcels.recipient")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("parcels.fullName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="Lê Văn Hùng" />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="0987 654 321" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("parcels.deliveryAddress")}
                </label>
                <textarea className={inputClass + " min-h-[72px]"} rows={2} />
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("parcels.parcelInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("parcels.shippingRoute")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="hcm-dl">
                  <option value="hcm-dl">HCM ➔ Đà Lạt</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("parcels.goodsType")}</label>
                <select className={inputClass} defaultValue="normal">
                  <option value="normal">{t("parcels.normalGoods")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {t("parcels.weightKg")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="5" />
              </div>
              <div>
                <label className={labelClass}>{t("parcels.dimensions")}</label>
                <input className={inputClass} defaultValue="40 x 30 x 20" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("parcels.contentDescription")}
                </label>
                <textarea
                  className={inputClass + " min-h-[72px]"}
                  placeholder={t("parcels.contentPlaceholder")}
                  rows={2}
                />
              </div>
              <div>
                <label className={labelClass}>{t("parcels.declaredValue")}</label>
                <input className={inputClass} defaultValue="1000000" />
              </div>
              <div>
                <label className={labelClass}>{t("parcels.feePayment")}</label>
                <select className={inputClass} defaultValue="sender">
                  <option value="sender">{t("parcels.senderPays")}</option>
                </select>
              </div>
            </div>
          </section>
          <div className="flex flex-col gap-2 rounded-lg bg-sky-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {t("parcels.estimatedFee")}
              </p>
              <p className="text-xs text-gray-500">
                {t("parcels.feeBreakdownExample")}
              </p>
            </div>
            <p className="text-2xl font-bold text-vr-700">50.000đ</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiPackage size={20} />}
        title={t("parcels.detailTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("close")}
            </button>
            {selectedParcel?.status === "in_transit" && (
              <button
                type="button"
                onClick={() => {
                  setOpenDetail(false);
                  setOpenDelivery(true);
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                {t("parcels.confirmDelivery")}
              </button>
            )}
          </>
        }
      >
        {selectedParcel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("parcels.orderCode")}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {selectedParcel.code}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {tc("status")}
                </p>
                <div className="mt-1">
                  {parcelStatusBadge(selectedParcel.status, t)}
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">
                {t("parcels.sender")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{tc("name")}</p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.sender}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("parcels.contact")}</p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.senderContact}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">
                {t("parcels.recipient")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{tc("name")}</p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.recipient}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("parcels.contact")}</p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.recipientContact ?? "--"}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">
                {t("parcels.parcelDetails")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{t("parcels.route")}</p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.route}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    {t("parcels.weightKg")}
                  </p>
                  <p className="font-semibold text-gray-900">
                    {selectedParcel.weightKg} kg
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">{t("parcels.feeLabel")}</span>
                <span className="text-2xl font-bold text-vr-600">
                  {selectedParcel.fee.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openDelivery}
        onClose={() => setOpenDelivery(false)}
        icon={<FiCheckCircle size={20} />}
        title={t("parcels.deliveryTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDelivery(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenDelivery(false);
                alert(t("parcels.deliverySuccess"));
              }}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              {t("parcels.confirmDelivery")}
            </button>
          </>
        }
      >
        {selectedParcel && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-bold">
                  {t("parcels.orderInfo", { code: selectedParcel.code })}
                </span>{" "}
                - {selectedParcel.route}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {t("parcels.recipientLabel")}{" "}
                <span className="font-semibold">
                  {selectedParcel.recipient}
                </span>
              </p>
            </div>

            <div>
              <label className={labelClass}>
                {t("parcels.deliveryDateTime")}
              </label>
              <input
                type="datetime-local"
                className={inputClass}
                defaultValue="2024-05-25T14:30"
              />
            </div>

            <div>
              <label className={labelClass}>{t("parcels.deliveryNotes")}</label>
              <textarea
                className={inputClass + " min-h-[80px]"}
                placeholder={t("parcels.deliveryNotesPlaceholder")}
                rows={3}
              />
            </div>

            <div>
              <label className={labelClass}>
                {t("parcels.goodsCondition")}
              </label>
              <select className={inputClass} defaultValue="intact">
                <option value="intact">{t("parcels.conditionIntact")}</option>
                <option value="damaged">
                  {t("parcels.conditionDamaged")}
                </option>
                <option value="partial">
                  {t("parcels.conditionPartial")}
                </option>
              </select>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-medium text-amber-900">
                {t("parcels.photoReminder")}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
