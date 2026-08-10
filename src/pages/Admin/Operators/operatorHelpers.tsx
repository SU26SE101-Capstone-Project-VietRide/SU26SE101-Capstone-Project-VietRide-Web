import {
  type AdminOperator,
  type CreateAdminOperatorRequest,
} from "../../../api/vietride";

export type OperatorStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";

export const OPERATOR_STATUSES: OperatorStatus[] = [
  "APPROVED",
  "PENDING",
  "SUSPENDED",
  "REJECTED",
];

export const emptyOperatorForm: CreateAdminOperatorRequest = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  businessRegistrationNumber: "",
  taxCode: "",
  addressStreet: "",
  addressWard: "",
  addressProvince: "",
  representativeName: "",
  representativePhone: "",
};

export function toKnownStatus(status: string): OperatorStatus {
  if (OPERATOR_STATUSES.includes(status as OperatorStatus)) {
    return status as OperatorStatus;
  }

  return "PENDING";
}

export function getOperatorAddress(operator: AdminOperator) {
  return {
    street: operator.address?.street ?? operator.addressStreet,
    ward: operator.address?.ward ?? operator.addressWard,
    province: operator.address?.province ?? operator.addressProvince,
  };
}

// Hàm dịch tối thiểu — tương thích với `t` của i18next (namespace common)
type TranslateFn = (key: string) => string;

export function getStatusBadge(status: string, tc: TranslateFn) {
  const config = {
    PENDING: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      label: tc("pending"),
    },
    APPROVED: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      label: tc("active"),
    },
    SUSPENDED: {
      bg: "bg-red-50",
      text: "text-red-700",
      label: tc("suspended"),
    },
    REJECTED: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      label: tc("rejected"),
    },
  };
  const c = config[toKnownStatus(status)];
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
