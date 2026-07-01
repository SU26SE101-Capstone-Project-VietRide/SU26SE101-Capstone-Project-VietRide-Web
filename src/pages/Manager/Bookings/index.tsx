import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClock,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiTag,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { bookings as mockBookings, type Booking } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";
const actionIconClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

const SOLD_SEATS = new Set(["A1", "A2", "B3", "C1", "D4", "E2", "F1", "G3"]);

function formatMoney(n: number) {
  return `${n.toLocaleString("vi-VN")}₫`;
}

export default function BookingsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [openDetail, setOpenDetail] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editSeats, setEditSeats] = useState<string[]>([]);

  const totalRecords = 1284;

  const filtered = useMemo(
    () =>
      mockBookings.filter(
        (b) =>
          b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.passenger.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.phone.replace(/\s/g, "").includes(searchTerm.replace(/\s/g, "")),
      ),
    [searchTerm],
  );

  const toggleSeat = (id: string) => {
    if (SOLD_SEATS.has(id)) return;
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const seatTotal = selectedSeats.length * 320000;

  function bookingStatusBadge(s: Booking["status"]) {
    if (s === "paid")
      return (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          {t("bookings.paid")}
        </span>
      );
    if (s === "pending")
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

  function seatLegend() {
    return (
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-4 w-6 rounded border border-gray-200 bg-white" />{" "}
          {t("bookings.available")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-vr-500" /> {t("bookings.selected")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-4 w-6 rounded border border-red-200 bg-red-50" />{" "}
          {t("bookings.sold")}
        </span>
      </div>
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
        <button
          type="button"
          onClick={() => {
            setSelectedSeats([]);
            setCounterOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("bookings.counterSale")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("bookings.todayTickets")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">1.284</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 8.1%
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
              <p className="text-sm text-gray-500">{t("bookings.ticketRevenue")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">₫184.2M</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 11.2%
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
              <p className="text-sm text-gray-500">{t("bookings.awaitingPayment")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">42</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                {t("bookings.pendingBadge")}
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
              <p className="text-sm text-gray-500">{t("bookings.cancelled")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">18</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                {t("bookings.cancelledBadge")}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiXCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t("bookings.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={inputClass + " pl-10"}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiFilter size={16} />
                {tc("filter")}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiList size={16} />
                {tc("columns")}
              </button>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:ml-0"
              >
                <FiDownload size={16} />
                {tc("exportCsv")}
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("bookings.ticketCode")}</th>
                <th className="px-5 py-3">{t("bookings.customer")}</th>
                <th className="px-5 py-3">{t("bookings.phoneShort")}</th>
                <th className="px-5 py-3">{t("bookings.trip")}</th>
                <th className="px-5 py-3">{t("bookings.seat")}</th>
                <th className="px-5 py-3">{t("bookings.amount")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {b.code}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-800">
                    {b.passenger}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{b.phone}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {b.tripCode}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {b.seat}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {formatMoney(b.price)}
                  </td>
                  <td className="px-5 py-4">{bookingStatusBadge(b.status)}</td>
                  <td className="px-5 py-4 text-sm">
                    <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBooking(b);
                        setOpenDetail(true);
                      }}
                      className={actionIconClass}
                      title={tc("details")}
                      aria-label={tc("details")}
                    >
                      <FiEye size={16} />
                    </button>
                    {b.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBooking(b);
                            setEditSeats([b.seat]);
                            setOpenEdit(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
                          title={tc("edit")}
                          aria-label={tc("edit")}
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t("bookings.confirmCancel"))) {
                              alert(t("bookings.cancelSuccess"));
                            }
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          title={t("bookings.cancelTicket")}
                          aria-label={t("bookings.cancelTicket")}
                        >
                          <FiXCircle size={16} />
                        </button>
                      </>
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
            {tc("showingItems", { count: filtered.length, total: totalRecords })}
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

      <Modal
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title={t("bookings.counterTitle")}
        subtitle={t("bookings.counterSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCounterOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => setCounterOpen(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("bookings.confirmPrint")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className={labelClass}>
              {t("bookings.selectTrip")} <span className="text-red-500">*</span>
            </label>
            <select className={inputClass} defaultValue="vr2401">
              <option value="vr2401">
                VR-2401 · HCM -&gt; Đà Lạt · 06:00 18/05
              </option>
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                {t("bookings.seatMap")}
              </h3>
              {seatLegend()}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:max-w-md">
              {Array.from({ length: 10 }, (_, row) =>
                [1, 2, 3, 4].map((col) => {
                  const letter = String.fromCharCode(65 + row);
                  const id = `${letter}${col}`;
                  const sold = SOLD_SEATS.has(id);
                  const sel = selectedSeats.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={sold}
                      onClick={() => toggleSeat(id)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition ${
                        sold
                          ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                          : sel
                            ? "border-vr-700 bg-vr-600 text-white"
                            : "border-gray-200 bg-white text-gray-800 hover:border-vr-300"
                      }`}
                    >
                      {id}
                    </button>
                  );
                }),
              ).flat()}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("bookings.customerInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("bookings.fullNameLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0901 234 567" />
              </div>
              <div>
                <label className={labelClass}>{t("bookings.idDoc")}</label>
                <input className={inputClass} placeholder="079..." />
              </div>
              <div>
                <label className={labelClass}>{tc("email")}</label>
                <input
                  className={inputClass}
                  placeholder={t("bookings.optionalPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>{t("bookings.pickupPoint")}</label>
                <select className={inputClass} defaultValue="west">
                  <option value="west">Bến xe Miền Tây</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("bookings.paymentMethod")}</label>
                <select className={inputClass} defaultValue="cash">
                  <option value="cash">{t("bookings.cash")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiUser className="text-gray-400" />
              {t("bookings.seatsSelected", { n: selectedSeats.length })}
            </div>
            <span className="text-lg font-bold text-vr-700">
              {formatMoney(seatTotal)}
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiTag size={20} />}
        title={t("bookings.detailTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("close")}
            </button>
            {selectedBooking?.status === "pending" && (
              <button
                type="button"
                onClick={() => {
                  setOpenDetail(false);
                  setEditSeats(selectedBooking?.seat ? [selectedBooking.seat] : []);
                  setOpenEdit(true);
                }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                {t("bookings.editTicket")}
              </button>
            )}
          </>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("bookings.ticketCode")}
                </p>
                <p className="text-lg font-bold text-gray-900">{selectedBooking.code}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{tc("status")}</p>
                <div className="mt-1">{bookingStatusBadge(selectedBooking.status)}</div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">
                {t("bookings.passengerInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{t("bookings.passengerName")}</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.passenger}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{tc("phone")}</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.phone}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">{t("bookings.tripInfo")}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">{t("bookings.tripCode")}</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.tripCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("bookings.seat")}</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.seat}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">{t("bookings.amountLabel")}</span>
                <span className="text-2xl font-bold text-vr-600">
                  {formatMoney(selectedBooking.price)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        icon={<FiTag size={20} />}
        title={t("bookings.editTitle")}
        wide
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenEdit(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenEdit(false);
                alert(t("bookings.updateSuccess"));
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              {t("bookings.saveChanges")}
            </button>
          </>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t("bookings.currentTrip")}</label>
              <input
                type="text"
                className={inputClass}
                value={selectedBooking.tripCode}
                disabled
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">
                  {t("bookings.selectNewSeat")}
                </h3>
                {seatLegend()}
              </div>
              <div className="grid grid-cols-4 gap-2 sm:max-w-md">
                {Array.from({ length: 10 }, (_, row) =>
                  [1, 2, 3, 4].map((col) => {
                    const letter = String.fromCharCode(65 + row);
                    const id = `${letter}${col}`;
                    const sold = SOLD_SEATS.has(id);
                    const sel = editSeats.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={sold}
                        onClick={() => setEditSeats([id])}
                        className={`rounded-lg border py-2 text-xs font-semibold transition ${
                          sold
                            ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                            : sel
                              ? "border-vr-700 bg-vr-600 text-white"
                              : "border-gray-200 bg-white text-gray-800 hover:border-vr-300"
                        }`}
                      >
                        {id}
                      </button>
                    );
                  }),
                ).flat()}
              </div>
            </div>
            <div>
              <label className={labelClass}>{tc("note")}</label>
              <input
                className={inputClass}
                placeholder={t("bookings.notePlaceholder")}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
