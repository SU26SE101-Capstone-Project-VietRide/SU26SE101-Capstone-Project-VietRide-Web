import type {
  CreateOperatorVoucherRequest,
  OperatorVoucher,
  UpdateOperatorVoucherRequest,
} from "../../../api/vietride";
import { formatDateTime, toDatetimeLocalValue } from "../../../utils/date";
import { toNumber } from "../../../utils/number";

export type VoucherServiceTab = "BOOKING" | "PARCEL";

export type VoucherForm = {
  code: string;
  name: string;
  type: string;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  totalUsageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validUntil: string;
  applicableService: VoucherServiceTab;
  applicableRouteIds: string;
  fundingType: string;
};

export function toIsoLocal(value: string) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

export function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toDatetimeLocalValue(date);
}

export function toRouteIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function routeIdsToValue(routeIds: string[]) {
  return routeIds.join(", ");
}

export function formatDate(value: string) {
  return formatDateTime(value);
}

export function formatMoney(value: number) {
  return value.toLocaleString("vi-VN");
}

export function truncateVoucherName(value: string) {
  return value.length > 30 ? value.slice(0, 29) + "…" : value;
}

export function getVoucherId(voucher: OperatorVoucher) {
  return voucher.id;
}

export function voucherServicesOf(voucher: OperatorVoucher) {
  return voucher.applicableServices ?? ["BOOKING"];
}

export function isBookingVoucher(voucher: OperatorVoucher) {
  return voucherServicesOf(voucher).includes("BOOKING");
}

export function isParcelVoucher(voucher: OperatorVoucher) {
  return voucherServicesOf(voucher).includes("PARCEL");
}

export function toForm(voucher: OperatorVoucher): VoucherForm {
  return {
    code: voucher.code,
    name: voucher.name,
    type: voucher.type,
    value: String(voucher.value),
    minOrderAmount: String(voucher.minOrderAmount),
    maxDiscountAmount: String(voucher.maxDiscountAmount),
    totalUsageLimit: String(voucher.totalUsageLimit),
    perUserLimit: String(voucher.perUserLimit),
    validFrom: voucher.validFrom ? toLocalDateTimeInput(voucher.validFrom) : "",
    validUntil: voucher.validUntil ? toLocalDateTimeInput(voucher.validUntil) : "",
    applicableService: isParcelVoucher(voucher) ? "PARCEL" : "BOOKING",
    applicableRouteIds: voucher.applicableRouteIds.join(", "),
    fundingType: voucher.fundingType ?? "OPERATOR_FUNDED",
  };
}

export function toCreateRequest(form: VoucherForm): CreateOperatorVoucherRequest {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    type: form.type,
    value: toNumber(form.value),
    minOrderAmount: toNumber(form.minOrderAmount),
    maxDiscountAmount: toNumber(form.maxDiscountAmount),
    totalUsageLimit: toNumber(form.totalUsageLimit),
    perUserLimit: toNumber(form.perUserLimit),
    validFrom: toIsoLocal(form.validFrom),
    validUntil: toIsoLocal(form.validUntil),
    applicableServices: [form.applicableService],
    applicableRouteIds: toRouteIds(form.applicableRouteIds),
    fundingType: form.fundingType,
  };
}

export function toUpdateRequest(form: VoucherForm): UpdateOperatorVoucherRequest {
  const request = toCreateRequest(form);

  return {
    name: request.name,
    value: request.value,
    minOrderAmount: request.minOrderAmount,
    maxDiscountAmount: request.maxDiscountAmount,
    totalUsageLimit: request.totalUsageLimit,
    perUserLimit: request.perUserLimit,
    validFrom: request.validFrom,
    validUntil: request.validUntil,
    applicableRouteIds: request.applicableRouteIds,
  };
}
