export function formatVietnamPhoneForDisplay(phone?: string | null) {
  if (!phone) {
    return "--";
  }

  const compact = phone.replace(/[\s().-]/g, "");

  if (compact.startsWith("+84")) {
    return `0${compact.slice(3)}`;
  }

  if (compact.startsWith("84")) {
    return `0${compact.slice(2)}`;
  }

  return phone;
}

export function normalizeVietnamPhoneForApi(phone: string) {
  const compact = phone.replace(/[^\d+]/g, "");

  if (compact.startsWith("+")) {
    return compact;
  }

  if (compact.startsWith("0")) {
    return `+84${compact.slice(1)}`;
  }

  if (compact.startsWith("84")) {
    return `+${compact}`;
  }

  return compact;
}
