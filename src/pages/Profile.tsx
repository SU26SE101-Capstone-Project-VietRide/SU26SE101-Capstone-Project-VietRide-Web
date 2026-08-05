import { FiCamera, FiChevronRight, FiEdit2, FiHome, FiLoader } from "react-icons/fi";
import { formatVietnamPhoneForDisplay } from "../utils/phone";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  role: string;
  country: string;
  city: string;
  postalCode: string;
  taxId: string;
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function toProfileState(operator: OperatorProfile): ProfileState {
  const name = splitName(operator.name);

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    email: operator.contactEmail,
    phone: operator.contactPhone,
    bio: operator.registrationStatus,
    role: "Manager",
    country: "Vietnam",
    city: operator.address.province,
    postalCode: operator.businessRegistrationNumber,
    taxId: operator.taxCode,
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentUser?.avatarUrl ?? null,
  );
  const [uploadingImage, setUploadingImage] = useState<
    "avatar" | "logo" | null
  >(null);
  const [imageMessage, setImageMessage] = useState("");
  const [profile, setProfile] = useState<ProfileState>({
    firstName: "",
    lastName: "",
    email: currentUser?.email ?? "",
    phone: "",
    bio: "",
    role: currentUser?.role ?? "",
    country: "Vietnam",
    city: "",
    postalCode: "",
    taxId: "",
  });

  const [formData, setFormData] = useState(profile);

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
        addressStreet: serverOperator.address.street,
        addressWard: serverOperator.address.ward,
        addressDistrict: serverOperator.address.district,
        addressProvince: serverOperator.address.province,
        representativeName: serverOperator.representativeName,
        representativePhone: serverOperator.representativePhone,
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
  };

  const handleSave = async () => {
    const user = getAuthUser();

    if (isOperatorRole(user?.role) && serverOperator) {
      const updated = await updateOperatorProfile({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        contactPhone: formData.phone,
        logoUrl: serverOperator.logoUrl ?? undefined,
        addressStreet: serverOperator.address.street,
        addressWard: serverOperator.address.ward,
        addressDistrict: serverOperator.address.district,
        addressProvince: formData.city,
        representativeName: serverOperator.representativeName,
        representativePhone: serverOperator.representativePhone,
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

    setIsEditing(false);
  };

  const handleCancel = () => {
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

  const initials =
    `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to={currentUser?.role === "SYSTEM_ADMIN" ? "/admin/dashboard" : "/manager/dashboard"}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <FiHome size={16} /> {t("profilePage.home")}
        </Link>
        <FiChevronRight size={16} className="text-gray-400" />
        <span className="text-gray-900 font-medium">{t("profilePage.userProfile")}</span>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("profilePage.userProfile")}</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* My Profile Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t("profilePage.myProfile")}</h2>

        {/* Profile Header */}
        <div className="flex items-start gap-6 pb-6 border-b border-gray-200 mb-6">
          <ImageUploadControl
            label={t("profilePage.avatarLabel")}
            imageUrl={avatarUrl}
            initials={initials}
            isUploading={uploadingImage === "avatar"}
            onFile={handleAvatarFile}
          />

          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {isOperator ? t(`enumLabels.${profile.bio}`) : profile.bio}
            </p>
            <p className="text-gray-500 text-sm mt-1">{t("profilePage.countryVietnam")}</p>



          </div>

          {!isEditing && (
            <button
              onClick={handleEdit}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-2 transition"
            >
              <FiEdit2 size={16} /> {t("edit")}
            </button>
          )}
        </div>

        {currentUser?.role === "OPERATOR_ADMIN" && serverOperator && (
          <div className="mb-6 border-b border-gray-200 pb-6">
            <ImageUploadControl
              label={t("profilePage.logoLabel")}
              imageUrl={serverOperator.logoUrl}
              isUploading={uploadingImage === "logo"}
              onFile={handleLogoFile}
            />
          </div>
        )}

        {imageMessage && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {imageMessage}
          </div>
        )}
        {/* Profile Form */}
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.firstName")}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.lastName")}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.emailAddress")}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.phone")}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">
                {isOperator
                  ? t("profilePage.operatorStatus")
                  : t("profilePage.bio")}
              </label>
              {isOperator ? (
                <>
                  <p className="w-full mt-2 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                    {t(`enumLabels.${formData.bio}`)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("profilePage.operatorFieldReadOnlyHint")}
                  </p>
                </>
              ) : (
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-vr-500 text-slate-900 rounded-lg font-semibold hover:bg-vr-600 transition"
              >
                {t("save")}
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.firstName")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">
                {profile.firstName}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.lastName")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">
                {profile.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.emailAddress")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.phone")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">{formatVietnamPhoneForDisplay(profile.phone)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {isOperator
                  ? t("profilePage.operatorStatus")
                  : t("profilePage.bio")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">
                {isOperator ? t(`enumLabels.${profile.bio}`) : profile.bio}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Address Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t("profilePage.address")}</h2>
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-2 transition"
            >
              <FiEdit2 size={16} /> {t("edit")}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.country")}
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-vr-500 text-slate-900 rounded-lg font-semibold hover:bg-vr-600 transition"
              >
                {t("save")}
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.country")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">
                {profile.country}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.cityState")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">{profile.city}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {isOperator
                  ? t("profilePage.businessRegistrationNumber")
                  : t("profilePage.postalCode")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">
                {profile.postalCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.taxId")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">{profile.taxId}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
