export type ActivityActionPresentation = {
  label: string;
  badgeClassName: string;
};

type LocalizedText = { vi: string; en: string };
type ActionDefinition = LocalizedText & { badgeClassName: string };

const neutralBadge = "bg-slate-100 text-slate-700 ring-slate-500/20";

const actionDefinitions: Record<string, ActionDefinition> = {
  LOCK_USER: { vi: "Khóa tài khoản", en: "Lock user", badgeClassName: "bg-red-50 text-red-700 ring-red-600/20" },
  UNLOCK_USER: { vi: "Mở khóa tài khoản", en: "Unlock user", badgeClassName: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  CREATE_USER: { vi: "Tạo tài khoản", en: "Create user", badgeClassName: "bg-cyan-50 text-cyan-700 ring-cyan-600/20" },
  CREATE_OPERATOR_USER: { vi: "Tạo nhân sự nhà xe", en: "Create operator user", badgeClassName: "bg-cyan-50 text-cyan-700 ring-cyan-600/20" },
  APPROVE_OPERATOR: { vi: "Duyệt nhà xe", en: "Approve operator", badgeClassName: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  REJECT_OPERATOR: { vi: "Từ chối nhà xe", en: "Reject operator", badgeClassName: "bg-orange-50 text-orange-700 ring-orange-600/20" },
  SUSPEND_OPERATOR: { vi: "Tạm ngưng nhà xe", en: "Suspend operator", badgeClassName: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  REACTIVATE_OPERATOR: { vi: "Kích hoạt lại nhà xe", en: "Reactivate operator", badgeClassName: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  STATION_MERGED: { vi: "Gộp bến", en: "Merge stations", badgeClassName: "bg-purple-50 text-purple-700 ring-purple-600/20" },
  COMPLETE_PROFILE: { vi: "Hoàn tất hồ sơ", en: "Complete profile", badgeClassName: neutralBadge },
  SET_INITIAL_PASSWORD: { vi: "Đặt mật khẩu ban đầu", en: "Set initial password", badgeClassName: neutralBadge },
  RESET_PASSWORD: { vi: "Đặt lại mật khẩu", en: "Reset password", badgeClassName: neutralBadge },
  UPDATE_PROFILE: { vi: "Cập nhật hồ sơ", en: "Update profile", badgeClassName: neutralBadge },
};

const metadataLabels: Record<string, LocalizedText> = {
  target: { vi: "Đối tượng", en: "Target" },
  targetType: { vi: "Loại đối tượng", en: "Target type" },
  targetId: { vi: "Mã đối tượng", en: "Target ID" },
  targetDisplayName: { vi: "Tên đối tượng", en: "Target name" },
  targetSecondaryText: { vi: "Thông tin bổ sung", en: "Additional information" },
  targetUserId: { vi: "Mã tài khoản", en: "Target user ID" },
  targetUserName: { vi: "Tên tài khoản", en: "Target user name" },
  targetUserDisplayName: { vi: "Tên tài khoản", en: "Target user name" },
  targetUserEmail: { vi: "Email tài khoản", en: "Target user email" },
  operatorId: { vi: "Mã nhà xe", en: "Operator ID" },
  operatorName: { vi: "Tên nhà xe", en: "Operator name" },
  sourceStationId: { vi: "Mã bến nguồn", en: "Source station ID" },
  sourceStationName: { vi: "Bến nguồn", en: "Source station" },
  targetStationId: { vi: "Mã bến đích", en: "Destination station ID" },
  targetStationName: { vi: "Bến đích", en: "Destination station" },
  destinationStationId: { vi: "Mã bến đích", en: "Destination station ID" },
  destinationStationName: { vi: "Bến đích", en: "Destination station" },
  source: { vi: "Nguồn thao tác", en: "Action source" },
  reason: { vi: "Lý do", en: "Reason" },
  status: { vi: "Trạng thái", en: "Status" },
};

const technicalValueDefinitions: Record<string, LocalizedText> = {
  OPERATOR_ADMIN_UNLOCK_USER: { vi: "Quản trị viên nhà xe mở khóa tài khoản", en: "Operator administrator unlocked a user" },
  OPERATOR_ADMIN_LOCK_USER: { vi: "Quản trị viên nhà xe khóa tài khoản", en: "Operator administrator locked a user" },
  OPERATOR_USER_CREATE: { vi: "Tạo tài khoản nhân sự nhà xe", en: "Operator user account creation" },
  SYSTEM_ADMIN: { vi: "Quản trị viên hệ thống", en: "System administrator" },
  OPERATOR_ADMIN: { vi: "Quản trị viên nhà xe", en: "Operator administrator" },
  OPERATOR_STAFF: { vi: "Nhân viên nhà xe", en: "Operator staff" },
  PASSENGER: { vi: "Hành khách", en: "Passenger" },
  DRIVER: { vi: "Tài xế", en: "Driver" },
  ASSISTANT: { vi: "Phụ xe", en: "Assistant" },
};

const vietnameseTokens: Record<string, string> = {
  ACTION: "thao tác", ADMIN: "quản trị viên", APPROVE: "duyệt", COMPLETE: "hoàn tất",
  CREATE: "tạo", DELETE: "xóa", DESTINATION: "đích", DRIVER: "tài xế", INITIAL: "ban đầu",
  LOCK: "khóa", MERGE: "gộp", MERGED: "đã gộp", OPERATOR: "nhà xe", PASSWORD: "mật khẩu",
  PROFILE: "hồ sơ", REACTIVATE: "kích hoạt lại", REJECT: "từ chối", RESET: "đặt lại",
  SET: "đặt", SOURCE: "nguồn", STAFF: "nhân viên", STATION: "bến", SUSPEND: "tạm ngưng",
  SYSTEM: "hệ thống", TARGET: "đối tượng", UNLOCK: "mở khóa", UPDATE: "cập nhật", USER: "tài khoản",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localized(definition: LocalizedText, language: string) {
  return language.startsWith("vi") ? definition.vi : definition.en;
}

function humanizeIdentifier(value: string, language = "en") {
  const tokens = value.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase().split("_").filter(Boolean);
  const text = language.startsWith("vi")
    ? tokens.map((token) => vietnameseTokens[token] ?? token.toLowerCase()).join(" ")
    : tokens.map((token) => token.toLowerCase()).join(" ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

function readableValue(value: unknown, language: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") {
    const definition = technicalValueDefinitions[value];
    return definition ? localized(definition, language) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function targetSnapshot(metadata: Record<string, unknown>) {
  return isRecord(metadata.target) ? metadata.target : null;
}

function userName(metadata: Record<string, unknown>) {
  const target = targetSnapshot(metadata);
  return stringValue(target?.displayName) ?? stringValue(metadata.targetDisplayName) ??
    stringValue(metadata.targetUserDisplayName) ?? stringValue(metadata.targetUserName) ??
    stringValue(metadata.targetUserEmail);
}

function operatorName(metadata: Record<string, unknown>) {
  const target = targetSnapshot(metadata);
  return stringValue(target?.displayName) ?? stringValue(metadata.targetDisplayName) ?? stringValue(metadata.operatorName);
}

export function getActionPresentation(action: string, language = "vi"): ActivityActionPresentation {
  const definition = actionDefinitions[action];
  return {
    label: definition ? localized(definition, language) : humanizeIdentifier(action, language),
    badgeClassName: definition?.badgeClassName ?? neutralBadge,
  };
}

export function getMetadataLabel(key: string, language = "vi") {
  const definition = metadataLabels[key];
  return definition ? localized(definition, language) : humanizeIdentifier(key, language);
}

export function getActivityContext(action: string, metadata: Record<string, unknown> | null, language = "vi") {
  const isVi = language.startsWith("vi");
  const actionLabel = getActionPresentation(action, language).label;
  if (!metadata) {
    if (action === "COMPLETE_PROFILE") return isVi ? "Hồ sơ cá nhân của người thực hiện" : "The actor's profile";
    if (action === "SET_INITIAL_PASSWORD") return isVi ? "Mật khẩu đăng nhập ban đầu" : "Initial sign-in password";
    return isVi ? "Không có thông tin bổ sung" : "No additional information";
  }

  if (action === "LOCK_USER" || action === "UNLOCK_USER") {
    const name = userName(metadata);
    return name ? `${actionLabel} ${name}` : actionLabel;
  }
  if (["APPROVE_OPERATOR", "REJECT_OPERATOR", "SUSPEND_OPERATOR", "REACTIVATE_OPERATOR"].includes(action)) {
    const name = operatorName(metadata);
    return name ? `${actionLabel} ${name}` : actionLabel;
  }
  if (action === "STATION_MERGED") {
    const source = stringValue(metadata.sourceStationName);
    const destination = stringValue(metadata.targetStationName) ?? stringValue(metadata.destinationStationName);
    if (source || destination) return `${isVi ? "Bến nguồn" : "Source"}: ${source ?? "—"} → ${isVi ? "bến đích" : "destination"}: ${destination ?? "—"}`;
    return actionLabel;
  }
  if (typeof metadata.source === "string") return readableValue(metadata.source, language);

  const firstReadableEntry = Object.entries(metadata).find(([key]) => !key.toLowerCase().endsWith("id") && key !== "target");
  return firstReadableEntry
    ? `${getMetadataLabel(firstReadableEntry[0], language)}: ${readableValue(firstReadableEntry[1], language)}`
    : actionLabel;
}

export function getReadableMetadata(metadata: Record<string, unknown> | null, language = "vi") {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    label: getMetadataLabel(key, language),
    value: readableValue(value, language),
  }));
}

export function formatIpAddress(value?: string | null) {
  if (!value) return "—";
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}
