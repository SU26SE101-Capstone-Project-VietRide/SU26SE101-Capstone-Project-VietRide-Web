// Helper thuần cục bộ của màn Admin Vouchers: đọc field voucher linh hoạt theo
// nhiều tên field BE, parse/format ngày và map form <-> request.
import type {
  AdminCampaignRequest,
  AdminOperator,
  AdminVoucher,
  CreateAdminVoucherRequest,
  UpdateAdminVoucherRequest,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import { toNumber } from "../../../utils/number";
import type { CampaignForm, VoucherForm } from "./types";

export const emptyForm: VoucherForm = {
  code: "",
  name: "",
  description: "",
  discountType: "PERCENT_OFF",
  discount: "10",
  maxDiscountAmount: "50000",
  applicableTo: "all",
  fundingType: "VIETRIDE_FUNDED",
  operatorScope: "ALL_OPERATORS",
  applicableOperatorIds: "",
  minOrderValue: "0",
  quantity: "1000",
  expiryDate: "",
  maxUsagePerUser: "1",
  active: true,
};

export const emptyCampaignForm: CampaignForm = {
  name: "",
  description: "",
  ownerOperatorId: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
  voucherIds: [],
};

export function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

export function maxDiscountAmountOf(form: VoucherForm) {
  return form.discountType === "FIXED_AMOUNT"
    ? toNumber(form.discount)
    : toNumber(form.maxDiscountAmount);
}

function voucherServicesOf(voucher: AdminVoucher) {
  return voucher.applicableServices ?? [];
}

export function discountTypeOf(voucher: AdminVoucher) {
  const type = (voucher.discountType ?? voucher.type ?? "").toUpperCase();
  return type.includes("FIXED") ? "fixed" : "percent";
}

export function discountValueOf(voucher: AdminVoucher) {
  return voucher.discount ?? voucher.value ?? 0;
}

export function quantityOf(voucher: AdminVoucher) {
  return voucher.quantity ?? voucher.totalUsageLimit ?? 0;
}

export function usedCountOf(voucher: AdminVoucher) {
  return voucher.usedCount ?? 0;
}

export function expiryDateOf(voucher: AdminVoucher) {
  return voucher.expiryDate ?? voucher.validUntil ?? "";
}

export function formatInputDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDisplayDate(value: string) {
  return formatDateOnly(value);
}

export function parseInputDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const vietnameseDate = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (vietnameseDate) {
    const [, day, month, year] = vietnameseDate;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
  }

  const browserDate = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (browserDate) {
    const [, year, month, day] = browserDate;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
  }

  return null;
}

function toEndOfDayIso(value: string) {
  const date = parseInputDate(value) ?? new Date();
  return date.toISOString();
}

export function activeOf(voucher: AdminVoucher) {
  return voucher.active ?? voucher.isActive ?? false;
}

export function toOperatorIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toApplicableServices(applicableTo: string) {
  if (applicableTo === "rides") {
    return ["BOOKING"];
  }

  if (applicableTo === "parcels") {
    return ["PARCEL"];
  }

  return ["BOOKING", "PARCEL"];
}

export function operatorIdsToValue(operatorIds: string[]) {
  return operatorIds.join(", ");
}

export function applicableToOf(voucher: AdminVoucher) {
  const services = voucherServicesOf(voucher);

  if (services.includes("BOOKING") && services.includes("PARCEL")) {
    return "all";
  }

  if (services.includes("PARCEL")) {
    return "parcels";
  }

  return "rides";
}

export function isActiveOperator(operator: AdminOperator) {
  return operator.registrationStatus === "APPROVED" && operator.isActive !== false;
}

export function toCreateRequest(form: VoucherForm): CreateAdminVoucherRequest {
  const selectedOperatorIds = toOperatorIds(form.applicableOperatorIds);

  return {
    name: form.name.trim(),
    type: form.discountType,
    value: toNumber(form.discount),
    minOrderAmount: toNumber(form.minOrderValue),
    maxDiscountAmount: maxDiscountAmountOf(form),
    totalUsageLimit: toNumber(form.quantity),
    perUserLimit: toNumber(form.maxUsagePerUser),
    validFrom: new Date().toISOString(),
    validUntil: toEndOfDayIso(form.expiryDate),
    newUserOnly: false,
    applicablePaymentMethods: ["VNPAY", "WALLET"],
    applicableServices: toApplicableServices(form.applicableTo),
    applicableOperatorIds:
      form.operatorScope === "SELECTED_OPERATORS" ? selectedOperatorIds : null,
    applicableRouteIds: null,
    fundingType: form.fundingType,
  };
}

export function toUpdateRequest(form: VoucherForm): UpdateAdminVoucherRequest {
  return {
    name: form.name.trim(),
    value: toNumber(form.discount),
    minOrderAmount: toNumber(form.minOrderValue),
    maxDiscountAmount: maxDiscountAmountOf(form),
    totalUsageLimit: toNumber(form.quantity),
    perUserLimit: toNumber(form.maxUsagePerUser),
    validUntil: toEndOfDayIso(form.expiryDate),
    newUserOnly: false,
    applicablePaymentMethods: ["VNPAY", "WALLET"],
    applicableServices: toApplicableServices(form.applicableTo),
    applicableRouteIds: null,
  };
}

export function toForm(voucher: AdminVoucher): VoucherForm {
  return {
    code: voucher.code,
    name: voucher.name,
    description: voucher.description ?? "",
    discountType: voucher.type ?? voucher.discountType ?? "PERCENT_OFF",
    discount: String(discountValueOf(voucher)),
    maxDiscountAmount: String(voucher.maxDiscountAmount ?? 0),
    applicableTo: applicableToOf(voucher),
    fundingType: voucher.fundingType ?? "VIETRIDE_FUNDED",
    operatorScope:
      voucher.applicableOperatorIds && voucher.applicableOperatorIds.length > 0
        ? "SELECTED_OPERATORS"
        : "ALL_OPERATORS",
    applicableOperatorIds: operatorIdsToValue(voucher.applicableOperatorIds ?? []),
    minOrderValue: String(voucher.minOrderAmount ?? voucher.minOrderValue ?? 0),
    quantity: String(quantityOf(voucher)),
    expiryDate: formatDisplayDate(expiryDateOf(voucher)),
    maxUsagePerUser: String(voucher.perUserLimit ?? voucher.maxUsagePerUser ?? 1),
    active: activeOf(voucher),
  };
}

export function toCampaignRequest(form: CampaignForm): AdminCampaignRequest {
  return {
    name: form.name.trim(),
    ownerOperatorId: form.ownerOperatorId || null,
    validFrom: toEndOfDayIso(form.validFrom),
    validUntil: toEndOfDayIso(form.validUntil),
    isActive: form.isActive,
    voucherIds: form.voucherIds,
  };
}
