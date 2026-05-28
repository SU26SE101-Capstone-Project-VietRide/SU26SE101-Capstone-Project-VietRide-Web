import { useState } from "react";

// ── Shared primitives ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-gray-600"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
    />
  );
}

// ── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "platform" | "booking" | "parcel" | "security";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "platform",
    label: "Nền tảng",
    icon: (
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
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
    ),
  },
  {
    id: "booking",
    label: "Đặt vé",
    icon: (
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
          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
        />
      </svg>
    ),
  },
  {
    id: "parcel",
    label: "Gửi hàng",
    icon: (
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
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Bảo mật",
    icon: (
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
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
];

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [tab, setTab] = useState<TabId>("platform");

  // Platform
  const [commission, setCommission] = useState("10");
  const [payCycle, setPayCycle] = useState("Hàng tuần");
  const [minPayout, setMinPayout] = useState("500000");
  const [currency, setCurrency] = useState("VND");

  // Booking
  const [cancelHours, setCancelHours] = useState("6");
  const [refundPct, setRefundPct] = useState("80");
  const [holdMinutes, setHoldMinutes] = useState("15");
  const [allowGuestBooking, setAllowGuestBooking] = useState(true);

  // Parcel
  const [requireOtp, setRequireOtp] = useState(true);
  const [maxWeight, setMaxWeight] = useState("50");
  const [insuranceThreshold, setInsuranceThreshold] = useState("2000000");
  const [autoCloseDays, setAutoCloseDays] = useState("7");

  // Security
  const [enable2fa, setEnable2fa] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [minPasswordLen, setMinPasswordLen] = useState("8");
  const [adminIpAllowlist, setAdminIpAllowlist] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          Cấu hình hệ thống
          <span className="inline-block rounded-full bg-gray-100 text-xs px-2 py-1 text-gray-600 font-normal">
            Admin
          </span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Thiết lập tham số vận hành toàn nền tảng: hoa hồng, chính sách huỷ vé,
          gửi hàng, bảo mật.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors ${
              tab === t.id
                ? "bg-teal-50 border-teal-300 text-teal-700 font-medium"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {tab === "platform" && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-5">
              Doanh thu &amp; chi trả
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field
                label="Hoa hồng nền tảng (%)"
                required
                hint="Áp dụng cho toàn bộ nhà xe."
              >
                <TextInput value={commission} onChange={setCommission} />
              </Field>
              <Field label="Chu kỳ chi trả" required>
                <TextInput value={payCycle} onChange={setPayCycle} />
              </Field>
              <Field label="Số dư tối thiểu chi trả (VND)">
                <TextInput value={minPayout} onChange={setMinPayout} />
              </Field>
              <Field label="Tiền tệ mặc định">
                <TextInput value={currency} onChange={setCurrency} />
              </Field>
            </div>
          </div>
        )}

        {tab === "booking" && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-5">
              Chính sách đặt vé &amp; huỷ vé
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Cho phép huỷ trước (giờ)" required>
                <TextInput value={cancelHours} onChange={setCancelHours} />
              </Field>
              <Field label="Hoàn tiền (%)" required>
                <TextInput value={refundPct} onChange={setRefundPct} />
              </Field>
              <Field label="Giữ ghế chưa thanh toán (phút)">
                <TextInput value={holdMinutes} onChange={setHoldMinutes} />
              </Field>
              <Field label="Cho phép đặt không cần tài khoản">
                <div className="pt-1">
                  <Toggle
                    checked={allowGuestBooking}
                    onChange={() => setAllowGuestBooking(!allowGuestBooking)}
                  />
                </div>
              </Field>
            </div>
          </div>
        )}

        {tab === "parcel" && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-5">
              Chính sách gửi hàng
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Bắt buộc OTP khi nhận hàng">
                <div className="pt-1">
                  <Toggle
                    checked={requireOtp}
                    onChange={() => setRequireOtp(!requireOtp)}
                  />
                </div>
              </Field>
              <Field label="Khối lượng tối đa (kg)">
                <TextInput value={maxWeight} onChange={setMaxWeight} />
              </Field>
              <Field label="Ngưỡng yêu cầu bảo hiểm (VND)">
                <TextInput
                  value={insuranceThreshold}
                  onChange={setInsuranceThreshold}
                />
              </Field>
              <Field label="Tự động đóng đơn sau (ngày)">
                <TextInput value={autoCloseDays} onChange={setAutoCloseDays} />
              </Field>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-5">
              Bảo mật tài khoản
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Bắt buộc xác thực 2 lớp (Admin/Manager)">
                <div className="pt-1">
                  <Toggle
                    checked={enable2fa}
                    onChange={() => setEnable2fa(!enable2fa)}
                  />
                </div>
              </Field>
              <Field label="Độ dài mật khẩu tối thiểu">
                <TextInput
                  value={minPasswordLen}
                  onChange={setMinPasswordLen}
                />
              </Field>
              <Field label="Hết hạn phiên (phút)">
                <TextInput
                  value={sessionTimeout}
                  onChange={setSessionTimeout}
                />
              </Field>
              <Field label="Bật IP allowlist cho Admin">
                <div className="pt-1">
                  <Toggle
                    checked={adminIpAllowlist}
                    onChange={() => setAdminIpAllowlist(!adminIpAllowlist)}
                  />
                </div>
              </Field>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 border-t border-gray-100 pt-5 flex justify-end gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50">
            Hoàn tác
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}
