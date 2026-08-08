import { FiCamera, FiChevronRight, FiEdit2, FiHome, FiLoader } from "react-icons/fi";
import { formatVietnamPhoneForDisplay } from "../utils/phone";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useToastFeedback } from "../hooks/useToastFeedback";
import { getAuthSession, getAuthUser, saveAuthSession } from "../auth";
import {
  getOperatorProfile,
  updateMyAvatar,
  updateOperatorProfile,
  type OperatorProfile,
} from "../api/vietride";
import {
  FirebaseImageError,
  uploadFirebaseImages,
} from "../utils/firebaseImageUpload";

type ProfileState = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  role: string;
  country: string;
  street: string;
  ward: string;
  district: string;
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
};

function toProfileState(operator: OperatorProfile): ProfileState {
  return {
    name: operator.name,
    email: operator.contactEmail,
    phone: operator.contactPhone,
    bio: operator.registrationStatus,
    role: "Manager",
    country: "Vietnam",
    street: operator.address.street,
    ward: operator.address.ward,
    district: operator.address.district,
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
  };
}

function isOperatorRole(role: string | undefined) {
  return role === "OPERATOR_ADMIN" || role === "OPERATOR_STAFF";
}

type ImageUploadControlProps = {
  label: string;
  imageUrl?: string | null;
  initials?: string;
  isUploading: boolean;
  onFile: (file: File) => void;
};

function ImageUploadControl({
  label,
  imageUrl,
  initials,
  isUploading,
  onFile,
}: ImageUploadControlProps) {
  const { t } = useTranslation("common");
  const inputId = useId();

  const selectFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <label
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          selectFile(event.dataTransfer.files);
        }}
        className="group relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-vr-300 bg-vr-50 transition hover:border-vr-500"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            width={112}
            height={112}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xl font-bold text-vr-700">{initials || <FiCamera />}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-white opacity-0 transition group-hover:opacity-100">
          <FiCamera size={22} />
        </span>
        {isUploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90 text-sm font-medium text-vr-700">
            <FiLoader className="animate-spin" size={24} />
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
      <p className="max-w-52 text-xs text-gray-500">{t("profilePage.imageHint")}</p>
    </div>
  );
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
export default function Profile() {
  const { t } = useTranslation("common");
  const [isEditing, setIsEditing] = useState(false);
  const [serverOperator, setServerOperator] = useState<OperatorProfile | null>(
    null,
  );
  const [error, setError] = useState("");
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
  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    email: currentUser?.email ?? "",
    phone: "",
    bio: "",
    role: currentUser?.role ?? "",
    country: "Vietnam",
    street: "",
    ward: "",
    district: "",
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
  });

  const [formData, setFormData] = useState(profile);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
            err instanceof Error ? err.message : t("profilePage.loadFailed"),
          );
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [t]);

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

      const updated = await updateOperatorProfile({
        name: serverOperator.name,
        contactPhone: serverOperator.contactPhone,
        logoUrl: uploadedUrl,
        addressStreet: formData.street,
        addressWard: formData.ward,
        addressDistrict: formData.district,
        addressProvince: serverOperator.address.province,
        representativeName: formData.representativeName,
        representativePhone: formData.representativePhone,
        cancellationPolicy: serverOperator.cancellationPolicy ?? null,
        parcelNoShowPolicy: serverOperator.parcelNoShowPolicy ?? null,
        luggagePolicy: serverOperator.luggagePolicy ?? null,
      });
      setServerOperator(updated);
      setImageMessage(t("profilePage.logoUpdated"));
    } catch (uploadError) {
      setError(imageErrorMessage(uploadError, t));
    } finally {
      setUploadingImage(null);
    }
  };
  const handleEdit = () => {
    setIsEditing(true);
    setFormData(profile);
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  };

  const handleSave = async () => {
    const user = getAuthUser();

    if (isOperatorRole(user?.role) && serverOperator) {
      const updated = await updateOperatorProfile({
        name: formData.name.trim(),
        contactPhone: formData.phone,
        logoUrl: serverOperator.logoUrl ?? undefined,
        addressStreet: formData.street,
        addressWard: formData.ward,
        addressDistrict: formData.district,
        addressProvince: formData.city,
        representativeName: formData.representativeName,
        representativePhone: formData.representativePhone,
        cancellationPolicy: serverOperator.cancellationPolicy ?? null,
        parcelNoShowPolicy: serverOperator.parcelNoShowPolicy ?? null,
        luggagePolicy: serverOperator.luggagePolicy ?? null,
      });

      const nextProfile = toProfileState(updated);
      setServerOperator(updated);
      setProfile(nextProfile);
      setFormData(nextProfile);
    } else {
      setProfile(formData);
    }

    setImageMessage(t("profilePage.profileUpdated"));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setImageMessage(t("profilePage.profileUpdated"));
    setIsEditing(false);
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

  const initials = profile.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5 bg-slate-50/70">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          to={currentUser?.role === "SYSTEM_ADMIN" ? "/admin/dashboard" : "/manager/dashboard"}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <FiHome size={16} /> {t("profilePage.home")}
        </Link>
        <FiChevronRight size={16} className="text-gray-400" />
        <span className="font-medium text-slate-800">{t("profilePage.userProfile")}</span>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("profilePage.userProfile")}</h1>
      </div>

      {/* My Profile Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="mb-5 text-lg font-bold text-slate-900">{t("profilePage.myProfile")}</h2>

        {/* Profile Header */}
        <div className="mb-6 flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-vr-50 via-white to-slate-50 p-5 sm:flex-row sm:items-start">
          <ImageUploadControl
            label={t("profilePage.avatarLabel")}
            imageUrl={avatarUrl}
            initials={initials}
            isUploading={uploadingImage === "avatar"}
            onFile={handleAvatarFile}
          />

          <div className="flex-1">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {isSystemAdmin ? t("profilePage.systemName") : profile.name}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {isOperator ? t(`enumLabels.${profile.bio}`) : profile.bio}
            </p>
            <p className="mt-1 text-sm text-slate-500">{t("profilePage.countryVietnam")}</p>



          </div>

          {!isEditing && isOperator && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-vr-300 hover:bg-vr-50"
            >
              <FiEdit2 size={16} /> {t("edit")}
            </button>
          )}
        </div>

        {currentUser?.role === "OPERATOR_ADMIN" && serverOperator && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <ImageUploadControl
              label={t("profilePage.logoLabel")}
              imageUrl={serverOperator.logoUrl}
              isUploading={uploadingImage === "logo"}
              onFile={handleLogoFile}
            />
          </div>
        )}
{isOperator ? (
          <div className="space-y-5">
        {/* Profile Form */}         {isEditing ? (
           <div className="space-y-5">
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               <div className="sm:col-span-2">
                 <label className="text-xs font-semibold text-slate-600">
                   {t("profilePage.operatorName")}
                 </label>
                 <input
                   ref={nameInputRef}
                   type="text"
                   name="name"
                   value={formData.name}
                   onChange={handleChange}
                   className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
                 />
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.emailAddress")}</label>
                 <input type="email" value={formData.email} readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" />
                 <p className="mt-1 text-xs text-slate-400">{t("profilePage.operatorFieldReadOnlyHint")}</p>
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.phone")}</label>
                 <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.representativeName")}</label>
                 <input type="text" name="representativeName" value={formData.representativeName} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.representativePhone")}</label>
                 <input type="tel" name="representativePhone" value={formData.representativePhone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />
               </div>
             </div>
           </div>
         ) : (
           <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
             <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{isOperator ? t("profilePage.operatorName") : t("profilePage.systemNameLabel")}</p><p className="mt-1.5 font-semibold text-slate-900">{isSystemAdmin ? t("profilePage.systemName") : profile.name}</p></div>
             <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.emailAddress")}</p><p className="mt-1.5 font-semibold text-slate-900">{profile.email}</p></div>
             <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.phone")}</p><p className="mt-1.5 font-semibold text-slate-900">{formatVietnamPhoneForDisplay(profile.phone)}</p></div>
             <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.representativeName")}</p><p className="mt-1.5 font-semibold text-slate-900">{profile.representativeName}</p></div>
             <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.representativePhone")}</p><p className="mt-1.5 font-semibold text-slate-900">{formatVietnamPhoneForDisplay(profile.representativePhone)}</p></div>
             {isOperator && <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.operatorStatus")}</p><p className="mt-1.5 font-semibold text-slate-900">{profile.bio ? t(`enumLabels.${profile.bio}`) : "-"}</p></div>}
           </div>
         )}

{/* Address Section */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t("profilePage.address")}</h2></div>

        {isEditing ? (
          <div className="space-y-4">

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.street")}
                </label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.cityState")}
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
            </div>

                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.ward")}</label>
                 <input type="text" name="ward" value={formData.ward} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-600">{t("profilePage.district")}</label>
                 <input type="text" name="district" value={formData.district} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />
               </div>
             </div>
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {isOperator
                    ? t("profilePage.businessRegistrationNumber")
                    : t("profilePage.postalCode")}
                </label>
                {isOperator ? (
                  <>
                    <p className="w-full mt-2 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                      {formData.postalCode}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {t("profilePage.operatorFieldReadOnlyHint")}
                    </p>
                  </>
                ) : (
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.taxId")}
                </label>
                <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500">{formData.taxId}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("profilePage.street")}
              </p>
              <p className="mt-1.5 font-semibold text-slate-900">
                {profile.street}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("profilePage.cityState")}
              </p>
              <p className="mt-1.5 font-semibold text-slate-900">{profile.city}</p>
            </div>             <div>
               <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.ward")}</p>
               <p className="mt-1.5 font-semibold text-slate-900">{profile.ward}</p>
             </div>
             <div>
               <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("profilePage.district")}</p>
               <p className="mt-1.5 font-semibold text-slate-900">{profile.district}</p>
             </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isOperator
                  ? t("profilePage.businessRegistrationNumber")
                  : t("profilePage.postalCode")}
              </p>
              <p className="mt-1.5 font-semibold text-slate-900">
                {profile.postalCode}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("profilePage.taxId")}
              </p>
              <p className="mt-1.5 font-semibold text-slate-900">{profile.taxId}</p>
            </div>
          </div>
        )}
       {isOperator && serverOperator && (
         <div className="mt-8 border-t border-slate-200 pt-8">
           <h2 className="mb-5 text-lg font-bold text-slate-900">{t("profilePage.policies")}</h2>
           <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
             <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{t("profilePage.luggagePolicy")}</p><p className="mt-1 font-semibold text-slate-900">{profile.luggageKgPerSeat ?? "—"} kg/ghế</p></div>
             <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{t("profilePage.noShowPolicy")}</p><p className="mt-1 font-semibold text-slate-900">{profile.noShowFeePercent ?? "—"}%</p></div>
             <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{t("profilePage.paymentTimeout")}</p><p className="mt-1 font-semibold text-slate-900">{profile.paymentTimeoutMinutes ?? "—"} phút</p></div>
           </div>
         </div>
       )}

      {isEditing && (
        <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 pb-1 pt-6 backdrop-blur sm:-mx-7 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-vr-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-vr-700 sm:w-auto"
          >
            {t("save")}
          </button>
        </div>
      )}
          </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold tracking-tight text-slate-900">{t("profilePage.accountInfo")}</h2>
              <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
                <div className="border-b border-slate-100 py-3 sm:col-span-2"><p className="text-xs font-medium text-slate-500">{t("profilePage.systemNameLabel")}</p><p className="mt-1 font-semibold text-slate-900">{t("profilePage.systemName")}</p></div>
                <div className="border-b border-slate-100 py-3"><p className="text-xs font-medium text-slate-500">{t("profilePage.emailAddress")}</p><p className="mt-1 break-words font-semibold text-slate-900">{profile.email || "-"}</p></div>
                <div className="border-b border-slate-100 py-3"><p className="text-xs font-medium text-slate-500">{t("profilePage.phone")}</p><p className="mt-1 font-semibold text-slate-900">{formatVietnamPhoneForDisplay(profile.phone) || "-"}</p></div>
                <div className="border-b border-slate-100 py-3 sm:col-span-2"><p className="text-xs font-medium text-slate-500">{t("profilePage.roleLabel")}</p><p className="mt-1 font-semibold text-slate-900">{t("profilePage.systemRole")}</p></div>
              </div>
            </section>
            <section className="rounded-2xl border border-vr-100 bg-vr-50/50 p-5">
              <h2 className="text-base font-bold tracking-tight text-slate-900">{t("profilePage.securityTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("profilePage.securityHint")}</p>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}




