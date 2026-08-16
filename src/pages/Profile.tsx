import { FiCamera, FiChevronRight, FiEdit2, FiHome, FiLoader } from "react-icons/fi";
import { formatVietnamPhoneForDisplay } from "../utils/phone";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useToastFeedback } from "../hooks/useToastFeedback";
import {
  clearAuthSession,
  getAuthSession,
  getAuthUser,
  getHomePathForRole,
  saveAuthSession,
  type AuthRole,
} from "../auth";
import {
  changePassword,
  getOperatorProfile,
  updateMyAvatar,
  updateOperatorProfile,
  type OperatorProfile,
} from "../api/vietride";
import { createIdempotencyKey } from "../api/idempotency";
import {
  FirebaseImageError,
  uploadFirebaseImages,
} from "../utils/firebaseImageUpload";
import { inputClass, labelClass } from "../components/form/formClasses";
import { ConfirmModal } from "../components/ConfirmModal";
import InlineAlert from "../components/InlineAlert";
import { ProfileCancellationPolicy } from "./ProfileCancellationPolicy";
import {
  createCancellationPolicyDraft,
  draftsFromCancellationPolicy,
  draftsFromCancellationTemplate,
  parseCancellationPolicyDrafts,
  type CancellationPolicyDraft,
} from "../utils/operatorCancellationPolicy";

const readOnlyInputClass = `${inputClass} cursor-not-allowed bg-gray-50 text-gray-500`;

// Bến/địa chỉ nhà xe — dữ liệu công ty, tách hẳn khỏi danh tính cá nhân người
// đăng nhập (hiện chỉ có ở AuthUser.displayName/email, không có API riêng để sửa).
type ProfileState = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  street: string;
  ward: string;
  city: string;
  postalCode: string;
  taxId: string;
  representativeName: string;
  representativePhone: string;
  isActive: boolean;
  logoUrl: string;
  luggageKgPerSeat: number | null;
  noShowFeePercent: number | null;
  paymentTimeoutMinutes: number | null;
  cancellationRules: CancellationPolicyDraft[];
};

const emptyProfile: ProfileState = {
  name: "",
  email: "",
  phone: "",
  bio: "",
  street: "",
  ward: "",
  city: "",
  postalCode: "",
  taxId: "",
  representativeName: "",
  representativePhone: "",
  isActive: false,
  logoUrl: "",
  luggageKgPerSeat: null,
  noShowFeePercent: null,
  paymentTimeoutMinutes: null,
  cancellationRules: [],
};

function toProfileState(operator: OperatorProfile): ProfileState {
  return {
    name: operator.name,
    email: operator.contactEmail,
    phone: operator.contactPhone,
    bio: operator.registrationStatus,
    street: operator.address.street,
    ward: operator.address.ward,
    city: operator.address.province,
    postalCode: operator.businessRegistrationNumber,
    taxId: operator.taxCode,
    representativeName: operator.representativeName,
    representativePhone: operator.representativePhone,
    isActive: operator.isActive,
    logoUrl: operator.logoUrl ?? "",
    luggageKgPerSeat: operator.luggagePolicy?.defaultLuggageKgPerSeat ?? null,
    noShowFeePercent: operator.parcelNoShowPolicy?.noShowFeePercent ?? null,
    paymentTimeoutMinutes:
      operator.parcelNoShowPolicy?.additionalPaymentTimeoutMinutes ?? null,
    cancellationRules: draftsFromCancellationPolicy(operator.cancellationPolicy),
  };
}

function isOperatorRole(role: string | undefined) {
  return role === "OPERATOR_ADMIN";
}

function roleBadgeLabel(role: AuthRole | undefined, t: (key: string) => string) {
  if (role === "SYSTEM_ADMIN") return t("profilePage.systemRole");
  if (role === "OPERATOR_ADMIN") return t("profilePage.operatorAdminRole");
  return "";
}

function imageErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof FirebaseImageError) {
    if (error.code === "INVALID_TYPE") {
      return t("profilePage.imageInvalidType");
    }
    if (error.code === "INVALID_SIZE") {
      return t("profilePage.imageInvalidSize");
    }
  }

  return error instanceof Error
    ? error.message
    : t("profilePage.imageUploadFailed");
}

// Đọc-chỉ trong chế độ xem: nhãn in hoa nhỏ phía trên + giá trị đậm bên dưới —
// dùng chung cho cả block "Thông tin nhà xe" lẫn "Địa chỉ" để đồng bộ style.
type FieldProps = { label: string; value: string; span2?: boolean };

function Field({ label, value, span2 }: FieldProps) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <p className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-semibold text-gray-900">{value || "-"}</p>
    </div>
  );
}

type PolicyStatProps = { label: string; value: string };

function PolicyStat({ label, value }: PolicyStatProps) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}

type ImageShape = "circle" | "square";

type ImageUploadControlProps = {
  label: string;
  imageUrl?: string | null;
  initials?: string;
  isUploading: boolean;
  shape?: ImageShape;
  onFile: (file: File) => void;
};

// Avatar cá nhân (shape="circle") và logo nhà xe (shape="square" mặc định)
// dùng chung control này — cùng logic chọn/kéo-thả/preview/lỗi, chỉ khác hình
// dạng khung để người dùng phân biệt ngay 2 loại ảnh khác nhau.
function ImageUploadControl({
  label,
  imageUrl,
  initials,
  isUploading,
  shape = "square",
  onFile,
}: ImageUploadControlProps) {
  const { t } = useTranslation("common");
  const inputId = useId();
  const isCircle = shape === "circle";

  const selectFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <label
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          selectFile(event.dataTransfer.files);
        }}
        className={`group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden border border-gray-200 bg-vr-50 transition hover:border-vr-400 ${
          isCircle ? "rounded-full" : "rounded-xl"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            width={96}
            height={96}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xl font-bold text-vr-700">
            {initials || <FiCamera />}
          </span>
        )}
        {/* Badge camera nhỏ đè góc (avatar tròn) hoặc dải dưới (logo vuông) —
            không che kín ảnh khi hover như overlay toàn khung trước đây. */}
        <span
          className={`absolute flex items-center justify-center bg-slate-900/70 text-white transition group-hover:bg-slate-900/85 ${
            isCircle
              ? "right-0 bottom-0 h-7 w-7 rounded-full ring-2 ring-white"
              : "inset-x-0 bottom-0 h-7 w-full"
          }`}
        >
          <FiCamera size={13} />
        </span>
        {isUploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/90 text-[11px] font-medium text-vr-700">
            <FiLoader className="animate-spin" size={20} />
            {t("profilePage.uploadingImage")}
          </span>
        )}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={isUploading}
        onChange={(event) => {
          selectFile(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="max-w-40 text-center text-[11px] text-gray-400 sm:text-left">
        {t("profilePage.imageHint")}
      </p>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation("common");
  const loadOperatorFailedMessage = t("profilePage.loadFailed");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverOperator, setServerOperator] = useState<OperatorProfile | null>(
    null,
  );
  const [error, setError] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  // Khởi tạo true ngay nếu là operator (đợt fetch đầu tiên) — tránh nhấp nháy
  // "chưa tải" trước khi effect kịp chạy. true chỉ set lại (khi bấm "Thử lại")
  // trong lúc render qua so sánh retryToken bên dưới, không set trong effect
  // (rule react-hooks/set-state-in-effect chặn setState đồng bộ đầu effect).
  const [isLoadingOperator, setIsLoadingOperator] = useState(() =>
    isOperatorRole(getAuthUser()?.role),
  );
  const [retryToken, setRetryToken] = useState(0);
  const [prevRetryToken, setPrevRetryToken] = useState(retryToken);
  if (retryToken !== prevRetryToken) {
    setPrevRetryToken(retryToken);
    setIsLoadingOperator(true);
  }
  const currentUser = getAuthUser();
  const isOperator = isOperatorRole(currentUser?.role);
  const isSystemAdmin = currentUser?.role === "SYSTEM_ADMIN";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentUser?.avatarUrl ?? null,
  );
  const [uploadingImage, setUploadingImage] = useState<
    "avatar" | "logo" | null
  >(null);
  const [imageMessage, setImageMessage] = useState("");
  useToastFeedback({ message: imageMessage, error });
  const [profile, setProfile] = useState<ProfileState>(emptyProfile);
  const [formData, setFormData] = useState(profile);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const passwordKeyRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isDirty = JSON.stringify(formData) !== JSON.stringify(profile);

  useEffect(() => {
    const user = getAuthUser();
    if (!isOperatorRole(user?.role)) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setError("");

      try {
        const operator = await getOperatorProfile();
        if (cancelled) {
          return;
        }

        const nextProfile = toProfileState(operator);
        setServerOperator(operator);
        setProfile(nextProfile);
        setFormData(nextProfile);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : loadOperatorFailedMessage,
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOperator(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [loadOperatorFailedMessage, retryToken]);

  const handleAvatarFile = async (file: File) => {
    setUploadingImage("avatar");
    setError("");
    setImageMessage("");

    try {
      const [uploadedUrl] = await uploadFirebaseImages("USER_AVATAR", [file]);
      if (!uploadedUrl) throw new Error(t("profilePage.avatarUrlMissing"));

      const result = await updateMyAvatar(uploadedUrl);
      setAvatarUrl(result.avatarUrl);
      const session = getAuthSession();
      if (session) {
        saveAuthSession({
          ...session,
          user: { ...session.user, avatarUrl: result.avatarUrl ?? undefined },
        });
      }
      setImageMessage(t("profilePage.avatarUpdated"));
    } catch (uploadError) {
      setError(imageErrorMessage(uploadError, t));
    } finally {
      setUploadingImage(null);
    }
  };

  const handleLogoFile = async (file: File) => {
    if (currentUser?.role !== "OPERATOR_ADMIN" || !serverOperator) {
      setError(t("profilePage.logoAdminOnly"));
      return;
    }

    setUploadingImage("logo");
    setError("");
    setImageMessage("");
    try {
      const [uploadedUrl] = await uploadFirebaseImages("OPERATOR_LOGO", [file]);
      if (!uploadedUrl) throw new Error(t("profilePage.logoUrlMissing"));

      const parsedCancellation = parseCancellationPolicyDrafts(
        formData.cancellationRules,
      );

      const updated = await updateOperatorProfile({
        name: serverOperator.name,
        contactPhone: serverOperator.contactPhone,
        logoUrl: uploadedUrl,
        addressStreet: formData.street,
        addressWard: formData.ward,
        addressProvince: serverOperator.address.province,
        representativeName: formData.representativeName,
        representativePhone: formData.representativePhone,
        cancellationPolicy: parsedCancellation.ok
          ? parsedCancellation.value
          : serverOperator.cancellationPolicy ?? null,
        parcelNoShowPolicy: serverOperator.parcelNoShowPolicy ?? null,
        luggagePolicy: serverOperator.luggagePolicy ?? null,
      });
      setServerOperator(updated);
      const nextProfile = toProfileState(updated);
      setProfile(nextProfile);
      setFormData((current) => ({ ...current, logoUrl: nextProfile.logoUrl }));
      setImageMessage(t("profilePage.logoUpdated"));
    } catch (uploadError) {
      setError(imageErrorMessage(uploadError, t));
    } finally {
      setUploadingImage(null);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setCancellationError("");
    setFormData(profile);
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  };

  const handleSave = async () => {
    if (!isOperator || !serverOperator || isSaving) {
      return;
    }

    const parsedCancellation = parseCancellationPolicyDrafts(
      formData.cancellationRules,
    );
    if (!parsedCancellation.ok) {
      setCancellationError(
        t(`profilePage.cancellationErrors.${parsedCancellation.error}`),
      );
      return;
    }

    setIsSaving(true);
    setError("");
    setCancellationError("");
    try {
      const updated = await updateOperatorProfile({
        name: formData.name.trim(),
        contactPhone: formData.phone,
        logoUrl: serverOperator.logoUrl ?? undefined,
        addressStreet: formData.street,
        addressWard: formData.ward,
        addressProvince: formData.city,
        representativeName: formData.representativeName,
        representativePhone: formData.representativePhone,
        cancellationPolicy: parsedCancellation.value,
        parcelNoShowPolicy: serverOperator.parcelNoShowPolicy ?? null,
        luggagePolicy: serverOperator.luggagePolicy ?? null,
      });

      const nextProfile = toProfileState(updated);
      setServerOperator(updated);
      setProfile(nextProfile);
      setFormData(nextProfile);
      setImageMessage(t("profilePage.profileUpdated"));
      setIsEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("profilePage.loadFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Bấm Huỷ khi KHÔNG có gì thay đổi → thoát edit ngay, không hỏi lại (hỏi
  // trong trường hợp này chỉ gây phiền). Có thay đổi chưa lưu → xác nhận trước
  // khi discard, tránh mất dữ liệu do bấm nhầm.
  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setIsEditing(false);
  };

  const handleConfirmDiscard = () => {
    setFormData(profile);
    setCancellationError("");
    setIsEditing(false);
    setShowDiscardConfirm(false);
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("profilePage.passwordRequired"));
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError(t("profilePage.passwordRules"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profilePage.passwordMismatch"));
      return;
    }

    const idempotencyKey = passwordKeyRef.current ?? createIdempotencyKey();
    passwordKeyRef.current = idempotencyKey;
    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword }, idempotencyKey);
      clearAuthSession();
      try {
        const { clearFirebaseAuthSession } = await import("../config/firebase");
        await clearFirebaseAuthSession();
      } catch {
        // Local VietRide session is already cleared; Firebase is optional.
      }
      navigate("/login", { replace: true, state: { message: t("profilePage.passwordChanged") } });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t("profilePage.passwordChangeFailed"));
    } finally {
      setPasswordLoading(false);
    }
  };
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateCancellationRule = (
    id: string,
    field: "hoursBeforeDeparture" | "feePercent",
    value: string,
  ) => {
    setCancellationError("");
    setFormData((prev) => ({
      ...prev,
      cancellationRules: prev.cancellationRules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule,
      ),
    }));
  };

  const addCancellationRule = () => {
    setFormData((prev) => ({
      ...prev,
      cancellationRules: [...prev.cancellationRules, createCancellationPolicyDraft()],
    }));
  };

  const removeCancellationRule = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      cancellationRules: prev.cancellationRules.filter((rule) => rule.id !== id),
    }));
  };

  const applyCancellationTemplate = () => {
    setCancellationError("");
    setFormData((prev) => ({
      ...prev,
      cancellationRules: draftsFromCancellationTemplate(),
    }));
  };

  const initials = (currentUser?.displayName ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  const canEditOperatorCard =
    isOperator && !isEditing && !isLoadingOperator && !error;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          to={currentUser ? getHomePathForRole(currentUser.role) : "/"}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <FiHome size={16} /> {t("profilePage.home")}
        </Link>
        <FiChevronRight size={16} className="text-gray-400" />
        <span className="font-medium text-gray-800">
          {t("profilePage.userProfile")}
        </span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">
        {t("profilePage.userProfile")}
      </h1>

      {/* Header: danh tính cá nhân người đang đăng nhập — avatar, tên, email,
          vai trò, trạng thái. Tên/công ty của NHÀ XE nằm ở card riêng bên dưới. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ImageUploadControl
            label={t("profilePage.avatarLabel")}
            imageUrl={avatarUrl}
            initials={initials}
            isUploading={uploadingImage === "avatar"}
            shape="circle"
            onFile={handleAvatarFile}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-gray-900">
              {currentUser?.displayName || "-"}
            </h2>
            <p className="mt-1 truncate text-sm text-gray-600">
              {currentUser?.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-vr-50 px-2.5 py-0.5 text-xs font-semibold text-vr-700">
                {roleBadgeLabel(currentUser?.role, t)}
              </span>
              {isOperator && serverOperator && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    serverOperator.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      serverOperator.isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {serverOperator.isActive
                    ? t("profilePage.statusActive")
                    : t("profilePage.statusInactive")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Thông tin nhà xe (operator roles) — logo, thông tin liên hệ, địa chỉ,
          chính sách vận hành. Tách hẳn khỏi card danh tính cá nhân phía trên. */}
      {isOperator && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">
              {t("profilePage.operatorInfoTitle")}
            </h2>
            {canEditOperatorCard && (
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-vr-300 hover:bg-vr-50"
              >
                <FiEdit2 size={16} /> {t("edit")}
              </button>
            )}
          </div>

          {error && !isLoadingOperator ? (
            <InlineAlert tone="error">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="mt-2 text-sm font-semibold underline underline-offset-2"
              >
                {t("profilePage.retry")}
              </button>
            </InlineAlert>
          ) : isLoadingOperator ? (
            <div className="space-y-5" aria-live="polite">
              <div className="h-24 w-24 animate-pulse rounded-xl bg-gray-100" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="h-14 animate-pulse rounded-lg bg-gray-100 sm:col-span-2" />
                <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {currentUser?.role === "OPERATOR_ADMIN" && serverOperator && (
                <ImageUploadControl
                  label={t("profilePage.logoLabel")}
                  imageUrl={serverOperator.logoUrl}
                  isUploading={uploadingImage === "logo"}
                  shape="square"
                  onFile={handleLogoFile}
                />
              )}

              {isEditing ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      {t("profilePage.operatorName")}
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t("profilePage.emailAddress")}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      readOnly
                      className={readOnlyInputClass}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {t("profilePage.operatorFieldReadOnlyHint")}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>{t("profilePage.phone")}</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t("profilePage.representativeName")}
                    </label>
                    <input
                      type="text"
                      name="representativeName"
                      value={formData.representativeName}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t("profilePage.representativePhone")}
                    </label>
                    <input
                      type="tel"
                      name="representativePhone"
                      value={formData.representativePhone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label={t("profilePage.operatorName")}
                    value={profile.name}
                    span2
                  />
                  <Field label={t("profilePage.emailAddress")} value={profile.email} />
                  <Field
                    label={t("profilePage.phone")}
                    value={formatVietnamPhoneForDisplay(profile.phone)}
                  />
                  <Field
                    label={t("profilePage.representativeName")}
                    value={profile.representativeName}
                  />
                  <Field
                    label={t("profilePage.representativePhone")}
                    value={formatVietnamPhoneForDisplay(profile.representativePhone)}
                  />
                  <Field
                    label={t("profilePage.operatorStatus")}
                    value={profile.bio ? t(`enumLabels.${profile.bio}`) : "-"}
                    span2
                  />
                </div>
              )}

              {/* Địa chỉ — thứ tự đúng phân cấp hành chính: đường → phường/xã →
                  quận/huyện → tỉnh/thành phố (trước đây bị đảo lộn). */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="mb-4 text-base font-bold text-gray-900">
                  {t("profilePage.address")}
                </h3>
                {isEditing ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>{t("profilePage.street")}</label>
                      <input
                        type="text"
                        name="street"
                        value={formData.street}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("profilePage.ward")}</label>
                      <input
                        type="text"
                        name="ward"
                        value={formData.ward}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("profilePage.cityState")}</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("profilePage.businessRegistrationNumber")}
                      </label>
                      <p className={readOnlyInputClass}>{formData.postalCode}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {t("profilePage.operatorFieldReadOnlyHint")}
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>{t("profilePage.taxId")}</label>
                      <p className={readOnlyInputClass}>{formData.taxId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label={t("profilePage.street")} value={profile.street} />
                    <Field label={t("profilePage.ward")} value={profile.ward} />
                    <Field label={t("profilePage.cityState")} value={profile.city} />
                    <Field
                      label={t("profilePage.businessRegistrationNumber")}
                      value={profile.postalCode}
                    />
                    <Field label={t("profilePage.taxId")} value={profile.taxId} />
                  </div>
                )}
              </div>

              {serverOperator && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="mb-4 text-base font-bold text-gray-900">
                    {t("profilePage.policies")}
                  </h3>
                  <ProfileCancellationPolicy
                    drafts={isEditing ? formData.cancellationRules : profile.cancellationRules}
                    isEditing={isEditing}
                    error={cancellationError}
                    onAdd={addCancellationRule}
                    onApplyTemplate={applyCancellationTemplate}
                    onChange={updateCancellationRule}
                    onRemove={removeCancellationRule}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <PolicyStat
                      label={t("profilePage.luggagePolicy")}
                      value={`${profile.luggageKgPerSeat ?? "—"} kg/ghế`}
                    />
                    <PolicyStat
                      label={t("profilePage.noShowPolicy")}
                      value={`${profile.noShowFeePercent ?? "—"}%`}
                    />
                    <PolicyStat
                      label={t("profilePage.paymentTimeout")}
                      value={`${profile.paymentTimeoutMinutes ?? "—"} phút`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {isEditing && (
            <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex flex-col gap-3 border-t border-gray-200 bg-white/95 px-5 pt-6 pb-1 backdrop-blur sm:-mx-7 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={handleCancelClick}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="w-full rounded-xl bg-vr-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {t("save")}
              </button>
            </div>
          )}
        </div>
      )}

      {isSystemAdmin && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold tracking-tight text-gray-900">
              {t("profilePage.accountInfo")}
            </h2>
            <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <div className="border-b border-gray-100 py-3 sm:col-span-2">
                <p className="text-xs font-medium text-gray-500">
                  {t("profilePage.phone")}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formatVietnamPhoneForDisplay(currentUser?.phone ?? "") || "-"}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-vr-100 bg-vr-50/50 p-5">
            <h2 className="text-base font-bold tracking-tight text-gray-900">
              {t("profilePage.securityTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {t("profilePage.securityHint")}
            </p>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-bold tracking-tight text-gray-900">
          {t("profilePage.changePasswordTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{t("profilePage.changePasswordHint")}</p>
        <form onSubmit={handleChangePassword} className="mt-5 max-w-xl space-y-4">
          {passwordError && <InlineAlert tone="error"><p>{passwordError}</p></InlineAlert>}
          <div>
            <label className={labelClass}>{t("profilePage.currentPassword")}</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
          </div>
          <div>
            <label className={labelClass}>{t("profilePage.newPassword")}</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">{t("profilePage.passwordRules")}</p>
          </div>
          <div>
            <label className={labelClass}>{t("profilePage.confirmPassword")}</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </div>
          <button type="submit" disabled={passwordLoading} className="rounded-xl bg-vr-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-60">
            {passwordLoading ? t("profilePage.changingPassword") : t("profilePage.changePassword")}
          </button>
        </form>
      </section>
      <ConfirmModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title={t("profilePage.discardChangesTitle")}
        message={t("profilePage.discardChangesMessage")}
        confirmLabel={t("profilePage.discardChangesConfirm")}
        cancelLabel={t("profilePage.continueEditing")}
        tone="warning"
      />
    </div>
  );
}
