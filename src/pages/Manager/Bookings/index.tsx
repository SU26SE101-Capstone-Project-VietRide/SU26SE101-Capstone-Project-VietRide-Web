import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiRefreshCw,
  FiSearch,
  FiTag,
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
import { formatCurrency } from "../../../utils/currency";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import { inputClass } from "../../../components/form/formClasses";
import { StatCard } from "../../../components/StatCard";
import { fetchAllPages } from "../../../api/pagination";

const PAGE_SIZE = 20;
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
  return formatCurrency(value);
}


function normalizeStatus(status?: string | null) {
  return (status || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function statusClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized.includes("cancel") || normalized.includes("fail")) {
    return "bg-red-50 text-red-800";
  }
  if (normalized.includes("no_show") || normalized.includes("partial_no_show")) {
    return "bg-amber-50 text-amber-800";
  }
  if (normalized.includes("expired")) {
    return "bg-slate-100 text-slate-700";
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

  const endpoints = [
    booking.trip.originName,
    booking.trip.destinationName,
  ].filter(Boolean);
  return endpoints.length > 0 ? endpoints.join(" - ") : "-";
}

function journeyLabel(booking: Pick<OperatorBookingListItem, "trip">) {
  const endpoints = [booking.trip.originName, booking.trip.destinationName].filter(Boolean);
  return endpoints.length > 0 ? endpoints.join(" → ") : "-";
}
function isPhoneSearch(value: string) {
  const normalized = value.replace(/[\s+().-]/g, "");
  return /^\d{7,}$/.test(normalized);
}

export default function BookingsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  useEffect(() => {
    tRef.current = t;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [bookingsPage, setBookingsPage] =
    useState<PagedResult<OperatorBookingListItem>>(emptyPage);
  const [stats, setStats] = useState<BookingStatsAggregate | null>(null);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [noShowPassengers, setNoShowPassengers] = useState(0);
  const [noShowBookingCount, setNoShowBookingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<OperatorBookingDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  useToastFeedback({ error: listError || detailError });

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
          error instanceof Error ? error.message : tRef.current("bookings.loadError"),
        );
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadBookings();
    return () => {
      isCurrent = false;
    };
  }, [debouncedSearch, page, reloadVersion, statusFilter]);

  useEffect(() => {
    let isCurrent = true;

    async function loadStats() {
      const [statsResult, pendingResult, noShowResult] =
        await Promise.allSettled([
          getOperatorBookingStats({ groupBy: "date" }),
          getOperatorBookings({
            status: "PENDING_PAYMENT",
            page: 1,
            pageSize: 1,
          }),
          fetchAllPages(({ page: nextPage, pageSize }) =>
            getOperatorBookings({
              status: "NO_SHOW",
              page: nextPage,
              pageSize,
            }),
          ),
        ]);

      if (!isCurrent) return;

      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setPendingBookings(
        pendingResult.status === "fulfilled"
          ? pendingResult.value.totalItems
          : 0,
      );
      if (noShowResult.status === "fulfilled") {
        setNoShowBookingCount(noShowResult.value.length);
        setNoShowPassengers(
          noShowResult.value.reduce(
            (total, booking) => total + booking.seatCount,
            0,
          ),
        );
      } else {
        setNoShowBookingCount(0);
        setNoShowPassengers(0);
      }
    }

    void loadStats();
    return () => {
      isCurrent = false;
    };
  }, [reloadVersion]);

  const metrics = useMemo(() => {
    const items = stats?.items ?? [];
    const sum = (
      key:
        | "totalBookings"
        | "totalCompleted"
        | "totalNoShows"
    ) => items.reduce((total, item) => total + (item[key] ?? 0), 0);
    const aggregate = (
      key: "totalCompleted" | "totalNoShows",
    ) => stats?.[key] ?? (items.length > 0 ? sum(key) : 0);
    const totalNoShows = aggregate("totalNoShows");

    return {
      totalBookings:
        stats?.totalBookings ??
        (items.length > 0 ? sum("totalBookings") : bookingsPage.totalItems),
      totalCompleted: aggregate("totalCompleted"),
      pendingBookings: stats?.pendingBookings ?? pendingBookings,
      totalNoShows: totalNoShows > 0 ? totalNoShows : noShowBookingCount,
      totalPassengers: noShowPassengers,
    };
  }, [
    bookingsPage.totalItems,
    noShowBookingCount,
    noShowPassengers,
    pendingBookings,
    stats,
  ]);

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

  const openBookingDetail = useCallback(
    async (id: string) => {
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
    },
    [t],
  );

  useEffect(() => {
    if (!bookingId) return;
    const timeoutId = window.setTimeout(
      () => void openBookingDetail(bookingId),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [bookingId, openBookingDetail]);

  function closeBookingDetail() {
    setOpenDetail(false);
    if (!bookingId) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("bookingId");
    setSearchParams(nextSearchParams, { replace: true });
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
        <StatCard
          icon={<FiTag size={20} />}
          iconClassName="bg-cyan-50 text-cyan-700"
          label={t("bookings.totalBookings")}
          value={metrics.totalBookings.toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<FiClock size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
          label={t("bookings.pendingBookings")}
          value={metrics.pendingBookings.toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<FiCheckCircle size={20} />}
          iconClassName="bg-emerald-50 text-emerald-700"
          label={t("bookings.completedBookings")}
          value={metrics.totalCompleted.toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<FiAlertCircle size={20} />}
          iconClassName="bg-orange-50 text-orange-700"
          label={t("bookings.noShowBookings")}
          value={metrics.totalNoShows.toLocaleString("vi-VN")}
          helper={t("bookings.totalPassengersHelper", {
            count: metrics.totalPassengers,
          })}
        />
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
                <option value="NO_SHOW">
                  {t("bookings.statuses.no_show")}
                </option>
                <option value="EXPIRED">
                  {t("bookings.statuses.expired")}
                </option>
              </CustomSelect>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed whitespace-nowrap" aria-busy={isLoading}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="w-[17%] px-3 py-3 text-left sm:px-5">{t("bookings.bookingCode")}</th>
                <th className="w-[30%] px-3 py-3 text-left sm:px-5">{t("bookings.route")}</th>
                <th className="w-[15%] px-3 py-3 text-center sm:px-5">{t("bookings.departure")}</th>
                <th className="w-[6%] px-3 py-3 text-center sm:px-5">{t("bookings.seatCount")}</th>
                <th className="w-[12%] px-3 py-3 text-right sm:px-5">{t("bookings.amount")}</th>
                <th className="w-[10%] px-3 py-3 text-center sm:px-5">{tc("status")}</th>
                <th className="w-[10%] px-3 py-3 text-center sm:px-5">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {bookingsPage.items.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="w-[17%] px-3 py-4 text-left text-sm font-semibold text-gray-900 sm:px-5">
                    {booking.bookingCode || "-"}
                  </td>
                  <td className="w-[30%] px-3 py-4 text-left text-sm font-medium text-gray-800 sm:px-5">
                    <span className="block truncate" title={routeLabel(booking)}>{routeLabel(booking)}</span>
                  </td>
                  <td className="w-[15%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700 sm:px-5">
                    {formatDateTime(
                      booking.trip.currentDepartureAt ??
                        booking.trip.departureAt,
                    )}
                  </td>
                  <td className="w-[6%] px-3 py-4 text-center text-sm font-medium text-gray-900 sm:px-5">
                    {booking.seatCount.toLocaleString("vi-VN")}
                  </td>
                  <td className="w-[12%] px-3 py-4 text-right text-sm font-semibold text-gray-900 sm:px-5">
                    {formatMoney(booking.totalAmount)}
                  </td>
                  <td className="w-[10%] px-3 py-4 text-center sm:px-5">{statusBadge(booking.status)}</td>
                  <td className="w-[10%] px-3 py-4 text-center text-sm sm:px-5">
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
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-gray-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FiRefreshCw className="animate-spin" />
                      {t("bookings.loading")}
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && bookingsPage.items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-gray-500"
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
          pageSize={PAGE_SIZE}
          totalItems={bookingsPage.totalItems}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={openDetail}
        onClose={closeBookingDetail}
        wide
        icon={<FiTag size={20} />}
        title={t("bookings.detailTitle")}
        footer={
          <button
            type="button"
            onClick={closeBookingDetail}
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
        {selectedBooking && !isDetailLoading && (
          <BookingDetailContent
            booking={selectedBooking}
            statusBadge={statusBadge}
          />
        )}
      </Modal>
    </div>
  );
}

type BookingDetailContentProps = {
  booking: OperatorBookingDetail;
  statusBadge: (status?: string | null) => React.ReactNode;
};

function BookingDetailContent({ booking, statusBadge }: BookingDetailContentProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const route = routeLabel(booking);
  const journey = journeyLabel(booking);
  const seats = booking.seats ?? [];
  const timeline = booking.statusTimeline ?? [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-vr-100 bg-gradient-to-br from-vr-50 via-white to-sky-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vr-700">{t("bookings.bookingCode")}</p>
            <p className="mt-2 break-all text-xl font-bold tracking-tight text-gray-950">{booking.bookingCode || "-"}</p>
            <div className="mt-3">{statusBadge(booking.status)}</div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm sm:min-w-44 sm:text-right">
            <p className="text-xs font-medium text-gray-500">{t("bookings.totalAmount")}</p>
            <p className="mt-1 text-2xl font-bold text-vr-700">{formatMoney(booking.totalAmount)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("bookings.route")}</p><p className="mt-2 font-semibold text-gray-900">{route}</p><p className="mt-1 text-sm text-gray-500">{journey}</p></div>
        <div className="rounded-xl border border-vr-200 bg-vr-50/60 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-vr-700">{t("bookings.departure")}</p><p className="mt-2 text-xl font-bold tracking-tight text-vr-900">{formatDateTime(booking.trip.currentDepartureAt ?? booking.trip.departureAt)}</p><p className="mt-1 text-sm font-medium text-vr-700">{booking.tripDirection || "-"}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("bookings.seatCount")}</p><p className="mt-2 text-2xl font-bold text-gray-900">{booking.seatCount.toLocaleString("vi-VN")}</p><p className="mt-1 text-sm text-gray-500">{t("bookings.seatDetails")}</p></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t("bookings.buyerInfo")} columns="two">
          <DetailItem label={t("bookings.fullNameLabel")} value={booking.buyer?.displayName || "-"} />
          <DetailItem label={tc("phone")} value={formatVietnamPhoneForDisplay(booking.buyer?.phone)} />
          <div className="rounded-lg border border-gray-200 bg-white p-3 sm:col-span-2">
            <p className="text-xs font-medium text-gray-500">{tc("email")}</p>
            <p className="mt-1 whitespace-nowrap text-sm font-semibold text-gray-900">{booking.buyer?.email || "-"}</p>
          </div>
        </DetailSection>
        <DetailSection title={t("bookings.bookingInfo")} columns="two">
          <DetailItem label={t("bookings.createdAt")} value={formatDateTime(booking.createdAt)} />
          <DetailItem label={t("bookings.status")} value={statusBadge(booking.status)} />
          <DetailItem label={t("bookings.tripDirection")} value={booking.tripDirection || "-"} />
          <DetailItem label={t("bookings.bookingCode")} value={booking.bookingCode || "-"} />
        </DetailSection>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3"><div><h3 className="text-base font-semibold text-gray-900">{t("bookings.fareInfo")}</h3><p className="mt-1 text-xs text-gray-500">{t("bookings.ticketRevenue")}</p></div><span className="rounded-lg bg-vr-50 px-3 py-1 text-xs font-semibold text-vr-700">đ</span></div>
        <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 text-gray-600"><span>{t("bookings.baseFare")}</span><span className="font-medium text-gray-900">{formatMoney(booking.baseFare)}</span></div><div className="flex justify-between gap-4 text-gray-600"><span>{t("bookings.discountAmount")}</span><span className="font-medium text-emerald-700">-{formatMoney(booking.discountAmount)}</span></div><div className="flex justify-between gap-4 border-t border-dashed border-gray-200 pt-3 text-base"><span className="font-semibold text-gray-900">{t("bookings.totalAmount")}</span><span className="font-bold text-vr-700">{formatMoney(booking.totalAmount)}</span></div></div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><div><h3 className="text-base font-semibold text-gray-900">{t("bookings.seatDetails")}</h3><p className="mt-1 text-xs text-gray-500">{seats.length} {t("bookings.seatCount")}</p></div></div>
        {seats.length === 0 ? <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">{t("bookings.noSeats")}</p> : <div className="mt-4 overflow-hidden rounded-xl border border-gray-100"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">{t("bookings.ticketCode")}</th><th className="px-4 py-3">{t("bookings.seatNumber")}</th><th className="px-4 py-3">{t("bookings.ticketStatus")}</th><th className="px-4 py-3">{t("bookings.boardingStatus")}</th></tr></thead><tbody>{seats.map((seat) => <tr key={seat.ticketId} className="border-t border-gray-100"><td className="px-4 py-3 font-semibold text-gray-900">{seat.ticketCode || "-"}</td><td className="px-4 py-3 text-gray-700">{seat.seatNumber || "-"}</td><td className="px-4 py-3">{statusBadge(seat.ticketStatus)}</td><td className="px-4 py-3">{statusBadge(seat.boardingStatus)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><h3 className="text-base font-semibold text-gray-900">{t("bookings.statusTimeline")}</h3>{timeline.length === 0 ? <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">{t("bookings.noTimeline")}</p> : <div className="relative mt-4 space-y-4 pl-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gray-200">{timeline.map((entry, index) => <div key={`${entry.occurredAt}-${index}`} className="relative flex gap-3"><span className="absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-vr-500 shadow-sm" /><div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2">{statusBadge(entry.status)}<time className="text-xs text-gray-500">{formatDateTime(entry.occurredAt)}</time></div>{entry.reasonCode && <p className="mt-2 text-sm text-gray-600">{t("bookings.reasonCode")}: {entry.reasonCode}</p>}</div></div>)}</div>}{booking.cancellationReason && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800"><span className="font-semibold">{t("bookings.cancellationReason")}:</span>{" "}{booking.cancellationReason}</div>}</section>
    </div>
  );
}
