import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiDollarSign,
  FiEye,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiXCircle,
} from "react-icons/fi";
import {
  getOperatorBooking,
  getOperatorBookings,
  getOperatorBookingStats,
  type BookingStatsAggregate,
  type OperatorBookingDetail,
  type OperatorBookingListItem,
  type PagedResult,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import { formatDateInputValue, formatDateTime } from "../../../utils/date";

const PAGE_SIZE = 20;
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const actionIconClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 disabled:cursor-not-allowed disabled:opacity-50";

const emptyPage: PagedResult<OperatorBookingListItem> = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")}₫`;
}

function normalizeStatus(status?: string | null) {
  return (status || "unknown").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function statusClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized.includes("cancel") || normalized.includes("fail")) {
    return "bg-red-50 text-red-800";
  }
  if (normalized.includes("pending") || normalized.includes("hold")) {
    return "bg-amber-50 text-amber-800";
  }
  if (
    normalized.includes("confirm") ||
    normalized.includes("paid") ||
    normalized.includes("complete")
  ) {
    return "bg-emerald-50 text-emerald-800";
  }

  return "bg-gray-100 text-gray-700";
}

function routeLabel(booking: Pick<OperatorBookingListItem, "trip">) {
  if (booking.trip.routeName) return booking.trip.routeName;

  const endpoints = [booking.trip.originName, booking.trip.destinationName].filter(
    Boolean,
  );
  return endpoints.length > 0 ? endpoints.join(" - ") : "-";
}

function journeyLabel(booking: Pick<OperatorBookingListItem, "trip">) {
  const endpoints = [booking.trip.originName, booking.trip.destinationName].filter(
    Boolean,
  );
  return endpoints.length > 0 ? endpoints.join(" → ") : "-";
}

function isPhoneSearch(value: string) {
  const normalized = value.replace(/[\s+().-]/g, "");
  return /^\d{7,}$/.test(normalized);
}

export default function BookingsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [bookingsPage, setBookingsPage] =
    useState<PagedResult<OperatorBookingListItem>>(emptyPage);
  const [stats, setStats] = useState<BookingStatsAggregate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<OperatorBookingDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isCurrent = true;

    async function loadBookings() {
      setIsLoading(true);
      setListError("");

      try {
        const searchParams = debouncedSearch
          ? isPhoneSearch(debouncedSearch)
            ? { passengerPhone: debouncedSearch }
            : { bookingCode: debouncedSearch }
          : {};
        const result = await getOperatorBookings({
          ...searchParams,
          status: statusFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy: "createdAt",
          sortDir: "desc",
        });

        if (isCurrent) setBookingsPage(result);
      } catch (error) {
        if (!isCurrent) return;
        setBookingsPage(emptyPage);
        setListError(
          error instanceof Error ? error.message : t("bookings.loadError"),
        );
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadBookings();
    return () => {
      isCurrent = false;
    };
  }, [debouncedSearch, page, reloadVersion, statusFilter, t]);

  useEffect(() => {
    let isCurrent = true;

    async function loadStats() {
      const today = formatDateInputValue(new Date());

      try {
        const result = await getOperatorBookingStats({
          from: today,
          to: today,
          groupBy: "date",
        });
        if (isCurrent) setStats(result);
      } catch {
        if (isCurrent) setStats(null);
      }
    }

    void loadStats();
    return () => {
      isCurrent = false;
    };
  }, [reloadVersion]);

  const metrics = useMemo(() => {
    const items = stats?.items ?? [];
    const sum = (key: "totalBookings" | "totalRevenue" | "totalCompleted" | "totalCancellations") =>
      items.reduce((total, item) => total + (item[key] ?? 0), 0);

    return {
      totalBookings:
        stats?.totalBookings ??
        (items.length > 0 ? sum("totalBookings") : bookingsPage.totalItems),
      totalRevenue: stats?.totalRevenue ?? sum("totalRevenue"),
      totalCompleted: stats?.totalCompleted ?? sum("totalCompleted"),
      totalCancelled:
        stats?.cancelledBookings ??
        stats?.totalCancellations ??
        sum("totalCancellations"),
    };
  }, [bookingsPage.totalItems, stats]);

  function statusBadge(status?: string | null) {
    const key = normalizeStatus(status);
    const label = t(`bookings.statuses.${key}`, {
      defaultValue: status || "-",
    });

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}
      >
        {label}
      </span>
    );
  }

  async function openBookingDetail(id: string) {
    setOpenDetail(true);
    setSelectedBooking(null);
    setDetailError("");
    setIsDetailLoading(true);

    try {
      setSelectedBooking(await getOperatorBooking(id));
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : t("bookings.detailLoadError"),
      );
    } finally {
      setIsDetailLoading(false);
    }
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
        <button
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
          disabled={isLoading}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {t("bookings.refresh")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiTag size={20} />}
          label={t("bookings.todayBookings")}
          value={metrics.totalBookings.toLocaleString("vi-VN")}
          badge={t("bookings.monitorOnlyBadge")}
        />
        <MetricCard
          icon={<FiDollarSign size={20} />}
          label={t("bookings.ticketRevenue")}
          value={formatMoney(metrics.totalRevenue)}
          badge={t("bookings.todayBadge")}
        />
        <MetricCard
          icon={<FiCheckCircle size={20} />}
          label={t("bookings.completedBookings")}
          value={metrics.totalCompleted.toLocaleString("vi-VN")}
          badge={t("bookings.statuses.completed")}
        />
        <MetricCard
          icon={<FiXCircle size={20} />}
          label={t("bookings.cancelledBookings")}
          value={metrics.totalCancelled.toLocaleString("vi-VN")}
          badge={t("bookings.statuses.cancelled")}
          danger
        />
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold">{t("bookings.monitorNoticeTitle")}</p>
        <p className="mt-1">{t("bookings.monitorNotice")}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder={t("bookings.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="w-full lg:w-72">
              <CustomSelect
                className={inputClass}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("bookings.allStatuses")}</option>
                <option value="PENDING_PAYMENT">
                  {t("bookings.statuses.pending_payment")}
                </option>
                <option value="CONFIRMED">
                  {t("bookings.statuses.confirmed")}
                </option>
                <option value="COMPLETED">
                  {t("bookings.statuses.completed")}
                </option>
                <option value="CANCELLED">
                  {t("bookings.statuses.cancelled")}
                </option>
              </CustomSelect>
            </div>
          </div>
          {listError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {listError}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]" aria-busy={isLoading}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("bookings.bookingCode")}</th>
                <th className="px-5 py-3">{t("bookings.route")}</th>
                <th className="px-5 py-3">{t("bookings.journey")}</th>
                <th className="px-5 py-3">{t("bookings.departure")}</th>
                <th className="px-5 py-3">{t("bookings.seatCount")}</th>
                <th className="px-5 py-3">{t("bookings.amount")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{t("bookings.createdAt")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {bookingsPage.items.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {booking.bookingCode || "-"}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-800">
                    {routeLabel(booking)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {journeyLabel(booking)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {formatDateTime(
                      booking.trip.currentDepartureAt ?? booking.trip.departureAt,
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {booking.seatCount.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {formatMoney(booking.totalAmount)}
                  </td>
                  <td className="px-5 py-4">{statusBadge(booking.status)}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {formatDateTime(booking.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <button
                      type="button"
                      onClick={() => void openBookingDetail(booking.id)}
                      className={actionIconClass}
                      title={tc("details")}
                      aria-label={tc("details")}
                    >
                      <FiEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && bookingsPage.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <FiRefreshCw className="animate-spin" />
                      {t("bookings.loading")}
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && bookingsPage.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-500">
                    {t("bookings.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={bookingsPage.totalItems}
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
        {isDetailLoading && (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
            <FiRefreshCw className="animate-spin" />
            {t("bookings.loadingDetail")}
          </div>
        )}
        {detailError && !isDetailLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {detailError}
          </div>
        )}
        {selectedBooking && !isDetailLoading && (
          <BookingDetailContent booking={selectedBooking} statusBadge={statusBadge} />
        )}
      </Modal>
    </div>
  );
}

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: string;
  danger?: boolean;
};

function MetricCard({ icon, label, value, badge, danger = false }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              danger ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {badge}
          </span>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

type BookingDetailContentProps = {
  booking: OperatorBookingDetail;
  statusBadge: (status?: string | null) => React.ReactNode;
};

function BookingDetailContent({ booking, statusBadge }: BookingDetailContentProps) {
  const { t } = useTranslation("manager");
  const route = routeLabel(booking);
  const journey = journeyLabel(booking);
  const seats = booking.seats ?? [];
  const timeline = booking.statusTimeline ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem
          label={t("bookings.bookingCode")}
          value={booking.bookingCode || "-"}
        />
        <DetailItem label={t("bookings.status")} value={statusBadge(booking.status)} />
        <DetailItem
          label={t("bookings.amount")}
          value={formatMoney(booking.totalAmount)}
        />
        <DetailItem
          label={t("bookings.seatCount")}
          value={booking.seatCount.toLocaleString("vi-VN")}
        />
      </div>

      <DetailSection title={t("bookings.bookingInfo")} columns="four">
        <DetailItem label={t("bookings.bookingId")} value={booking.id} />
        <DetailItem label={t("bookings.buyerUserId")} value={booking.buyerUserId} />
        <DetailItem
          label={t("bookings.createdAt")}
          value={formatDateTime(booking.createdAt)}
        />
        <DetailItem
          label={t("bookings.tripDirection")}
          value={booking.tripDirection || "-"}
        />
      </DetailSection>

      <DetailSection title={t("bookings.tripInfo")} columns="four">
        <DetailItem label={t("bookings.tripId")} value={booking.tripId} />
        <DetailItem label={t("bookings.route")} value={route} />
        <DetailItem label={t("bookings.journey")} value={journey} />
        <DetailItem
          label={t("bookings.departure")}
          value={formatDateTime(
            booking.trip.currentDepartureAt ?? booking.trip.departureAt,
          )}
        />
      </DetailSection>

      <DetailSection title={t("bookings.fareInfo")} columns="three">
        <DetailItem
          label={t("bookings.baseFare")}
          value={formatMoney(booking.baseFare)}
        />
        <DetailItem
          label={t("bookings.discountAmount")}
          value={formatMoney(booking.discountAmount)}
        />
        <DetailItem
          label={t("bookings.totalAmount")}
          value={formatMoney(booking.totalAmount)}
        />
      </DetailSection>

      <section className="border-t border-gray-200 pt-5">
        <h3 className="text-base font-semibold text-gray-900">
          {t("bookings.seatDetails")}
        </h3>
        {seats.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("bookings.noSeats")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">{t("bookings.ticketCode")}</th>
                  <th className="px-4 py-3">{t("bookings.seatNumber")}</th>
                  <th className="px-4 py-3">{t("bookings.ticketStatus")}</th>
                  <th className="px-4 py-3">{t("bookings.boardingStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {seats.map((seat) => (
                  <tr key={seat.ticketId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {seat.ticketCode || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {seat.seatNumber || "-"}
                    </td>
                    <td className="px-4 py-3">{statusBadge(seat.ticketStatus)}</td>
                    <td className="px-4 py-3">{statusBadge(seat.boardingStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h3 className="text-base font-semibold text-gray-900">
          {t("bookings.statusTimeline")}
        </h3>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("bookings.noTimeline")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {timeline.map((entry, index) => (
              <div
                key={`${entry.occurredAt}-${index}`}
                className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  {statusBadge(entry.status)}
                  {entry.reasonCode && (
                    <p className="mt-1 text-sm text-gray-600">
                      {t("bookings.reasonCode")}: {entry.reasonCode}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {formatDateTime(entry.occurredAt)}
                </p>
              </div>
            ))}
          </div>
        )}
        {booking.cancellationReason && (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
            <span className="font-semibold">{t("bookings.cancellationReason")}:</span>{" "}
            {booking.cancellationReason}
          </div>
        )}
      </section>
    </div>
  );
}
