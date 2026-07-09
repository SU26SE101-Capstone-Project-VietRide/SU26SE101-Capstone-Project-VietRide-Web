import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClock,
  FiDollarSign,
  FiDownload,
  FiEye,
  FiFilter,
  FiList,
  FiRefreshCw,
  FiSearch,
  FiTag,
} from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import { bookings as mockBookings, type Booking } from "../../../data/mockData";
import { formatDateTime } from "../../../utils/date";

type RefundStatus = NonNullable<Booking["refundStatus"]>;
type RefundFilter = "all" | RefundStatus;

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const actionIconClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

function formatMoney(n: number) {
  return `${n.toLocaleString("vi-VN")}₫`;
}

function getRefundStatus(booking: Booking): RefundStatus {
  if (booking.refundStatus) return booking.refundStatus;
  return booking.status === "cancelled" ? "pending" : "not_applicable";
}

export default function BookingsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [refundFilter, setRefundFilter] = useState<RefundFilter>("all");
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(
    () =>
      mockBookings.filter((booking) => {
        const query = searchTerm.toLowerCase();
        const normalizedPhone = booking.phone.replace(/\s/g, "");
        const matchesSearch =
          booking.code.toLowerCase().includes(query) ||
          booking.passenger.toLowerCase().includes(query) ||
          normalizedPhone.includes(searchTerm.replace(/\s/g, ""));
        const matchesRefund =
          refundFilter === "all" || getRefundStatus(booking) === refundFilter;

        return matchesSearch && matchesRefund;
      }),
    [refundFilter, searchTerm],
  );

  const metrics = useMemo(() => {
    const paidRevenue = mockBookings
      .filter((booking) => booking.status === "paid")
      .reduce((sum, booking) => sum + booking.price, 0);
    const pendingPayment = mockBookings.filter(
      (booking) => booking.status === "pending",
    ).length;
    const refundPending = mockBookings.filter(
      (booking) => getRefundStatus(booking) === "pending",
    ).length;
    const refundFailed = mockBookings.filter(
      (booking) => getRefundStatus(booking) === "failed",
    ).length;

    return {
      paidRevenue,
      pendingPayment,
      refundPending,
      refundFailed,
      refundAttention: refundPending + refundFailed,
      totalBookings: mockBookings.length,
    };
  }, []);

  const paginatedBookings = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const selectedRefundStatus = selectedBooking
    ? getRefundStatus(selectedBooking)
    : "not_applicable";

  function bookingStatusBadge(status: Booking["status"]) {
    if (status === "paid")
      return (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          {t("bookings.paid")}
        </span>
      );
    if (status === "pending")
      return (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          {t("bookings.pendingPayment")}
        </span>
      );
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        {t("bookings.cancelled")}
      </span>
    );
  }

  function refundStatusBadge(status: RefundStatus) {
    const statusClass: Record<RefundStatus, string> = {
      not_applicable: "bg-gray-100 text-gray-700",
      pending: "bg-amber-50 text-amber-800",
      refunded: "bg-emerald-50 text-emerald-800",
      failed: "bg-red-50 text-red-800",
    };

    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[status]}`}
      >
        {t(`bookings.refundStatuses.${status}`)}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("bookings.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("bookings.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {t("bookings.todayTickets")}
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {metrics.totalBookings}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {t("bookings.monitorOnlyBadge")}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTag size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {t("bookings.ticketRevenue")}
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {formatMoney(metrics.paidRevenue)}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {t("bookings.paid")}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiDollarSign size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {t("bookings.awaitingPayment")}
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {metrics.pendingPayment}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {t("bookings.pendingPayment")}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiClock size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {t("bookings.refundAttention")}
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {metrics.refundAttention}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                {t("bookings.refundAttentionBadge", {
                  pending: metrics.refundPending,
                  failed: metrics.refundFailed,
                })}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiRefreshCw size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t("bookings.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                className={inputClass + " pl-10"}
              />
            </div>
            <div className="w-full sm:w-72">
              <CustomSelect
                className={inputClass}
                value={refundFilter}
                onChange={(event) => {
                  setRefundFilter(event.target.value as RefundFilter);
                  setPage(1);
                }}
              >
                <option value="all">{t("bookings.allRefundStatuses")}</option>
                <option value="not_applicable">
                  {t("bookings.refundStatuses.not_applicable")}
                </option>
                <option value="pending">
                  {t("bookings.refundStatuses.pending")}
                </option>
                <option value="refunded">
                  {t("bookings.refundStatuses.refunded")}
                </option>
                <option value="failed">
                  {t("bookings.refundStatuses.failed")}
                </option>
              </CustomSelect>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiFilter size={16} />
                {tc("filter")}
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiList size={16} />
                {tc("columns")}
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiDownload size={16} />
                {tc("exportCsv")}
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("bookings.ticketCode")}</th>
                <th className="px-5 py-3">{t("bookings.customer")}</th>
                <th className="px-5 py-3">{t("bookings.phoneShort")}</th>
                <th className="px-5 py-3">{t("bookings.trip")}</th>
                <th className="px-5 py-3">{t("bookings.seat")}</th>
                <th className="px-5 py-3">{t("bookings.amount")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{t("bookings.refundStatus")}</th>
                <th className="px-5 py-3">{t("bookings.refundAmount")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((booking) => {
                const refundStatus = getRefundStatus(booking);

                return (
                  <tr
                    key={booking.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {booking.code}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-800">
                      {booking.passenger}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {booking.phone}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {booking.tripCode}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {booking.seat}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {formatMoney(booking.price)}
                    </td>
                    <td className="px-5 py-4">
                      {bookingStatusBadge(booking.status)}
                    </td>
                    <td className="px-5 py-4">
                      {refundStatusBadge(refundStatus)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {booking.refundAmount
                        ? formatMoney(booking.refundAmount)
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setOpenDetail(true);
                        }}
                        className={actionIconClass}
                        title={tc("details")}
                        aria-label={tc("details")}
                      >
                        <FiEye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    {t("bookings.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        wide
        icon={<FiTag size={20} />}
        title={t("bookings.detailTitle")}
        footer={
          <button
            type="button"
            onClick={() => setOpenDetail(false)}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
        }
      >
        {selectedBooking && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem
                label={t("bookings.ticketCode")}
                value={selectedBooking.code}
              />
              <DetailItem
                label={tc("status")}
                value={bookingStatusBadge(selectedBooking.status)}
              />
              <DetailItem
                label={t("bookings.amount")}
                value={formatMoney(selectedBooking.price)}
              />
              <DetailItem
                label={t("bookings.refundStatus")}
                value={refundStatusBadge(selectedRefundStatus)}
              />
            </div>

            <DetailSection title={t("bookings.passengerInfo")}>
              <DetailItem
                label={t("bookings.passengerName")}
                value={selectedBooking.passenger}
              />
              <DetailItem label={tc("phone")} value={selectedBooking.phone} />
            </DetailSection>

            <DetailSection title={t("bookings.tripInfo")} columns="four">
              <DetailItem
                label={t("bookings.tripCode")}
                value={selectedBooking.tripCode}
              />
              <DetailItem label={t("bookings.seat")} value={selectedBooking.seat} />
              <DetailItem
                label={t("bookings.paymentMethod")}
                value={
                  selectedBooking.paymentMethod
                    ? t(
                        `bookings.paymentMethods.${selectedBooking.paymentMethod}`,
                      )
                    : "-"
                }
              />
              <DetailItem
                label={t("bookings.createdAt")}
                value={formatDateTime(selectedBooking.createdAt)}
              />
            </DetailSection>

            <DetailSection title={t("bookings.refundInfo")} columns="three">
              <DetailItem
                label={t("bookings.refundStatus")}
                value={refundStatusBadge(selectedRefundStatus)}
              />
              <DetailItem
                label={t("bookings.refundAmount")}
                value={
                  selectedBooking.refundAmount
                    ? formatMoney(selectedBooking.refundAmount)
                    : "-"
                }
              />
              <DetailItem
                label={t("bookings.cancellationFee")}
                value={
                  selectedBooking.cancellationFee !== undefined
                    ? formatMoney(selectedBooking.cancellationFee)
                    : "-"
                }
              />
              <DetailItem
                label={t("bookings.cancelledAt")}
                value={formatDateTime(selectedBooking.cancelledAt)}
              />
              <DetailItem
                label={t("bookings.cancelledBy")}
                value={
                  selectedBooking.cancelledBy
                    ? t(
                        `bookings.cancelledByOptions.${selectedBooking.cancelledBy}`,
                      )
                    : "-"
                }
              />
              <DetailItem
                label={t("bookings.refundTransactionId")}
                value={selectedBooking.refundTransactionId || "-"}
              />
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("bookings.refundReason")}
                </p>
                <p className="mt-1">
                  {selectedBooking.refundReason || t("bookings.noRefundReason")}
                </p>
              </div>
            </DetailSection>
          </div>
        )}
      </Modal>
    </div>
  );
}
