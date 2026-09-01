// Type cục bộ của màn Admin Vouchers (form voucher + form campaign)

export type VoucherForm = {
  code: string;
  name: string;
  description: string;
  discountType: string;
  discount: string;
  maxDiscountAmount: string;
  applicableTo: string;
  operatorScope: "ALL" | "SELECTED";
  selectedOperatorIds: string[];
  minOrderValue: string;
  quantity: string;
  expiryDate: string;
  maxUsagePerUser: string;
  active: boolean;
};

export type CampaignForm = {
  name: string;
  description: string;
  ownerOperatorId: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  voucherIds: string[];
};
