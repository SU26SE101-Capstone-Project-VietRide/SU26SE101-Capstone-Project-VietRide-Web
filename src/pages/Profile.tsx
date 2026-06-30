import { FiEdit2, FiHome, FiChevronRight } from "react-icons/fi";
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAuthUser } from "../auth";
import {
  getOperatorProfile,
  updateOperatorProfile,
  type OperatorProfile,
} from "../api/vietride";

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

export default function Profile() {
  const { t } = useTranslation("common");
  const [isEditing, setIsEditing] = useState(false);
  const [serverOperator, setServerOperator] = useState<OperatorProfile | null>(
    null,
  );
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileState>({
    firstName: "Nguyễn",
    lastName: "Văn A",
    email: "nguyenvana@vietride.com",
    phone: "+84 901 234 567",
    bio: "Team Manager",
    role: "Manager",
    country: "Vietnam",
    city: "Ho Chi Minh City",
    postalCode: "700000",
    taxId: "VR-123456789",
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
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

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
        cancellationPolicy: serverOperator.cancellationPolicy ?? "",
        parcelNoShowPolicy: serverOperator.parcelNoShowPolicy ?? "",
        luggagePolicy: serverOperator.luggagePolicy ?? "",
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
        <button className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
          <FiHome size={16} /> {t("profilePage.home")}
        </button>
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
          <div className="w-24 h-24 bg-gradient-to-br from-vr-400 to-vr-700 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {initials}
          </div>

          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-gray-600 text-sm mt-1">{profile.bio}</p>
            <p className="text-gray-500 text-sm mt-1">Vietnam</p>

            <div className="flex items-center gap-3 mt-4">
              <button className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <FaFacebook size={18} />
              </button>
              <button className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <FaTwitter size={18} />
              </button>
              <button className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <FaLinkedin size={18} />
              </button>
              <button className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <FaInstagram size={18} />
              </button>
            </div>
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

        {/* Profile Form */}
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
              <label className="text-xs text-gray-600 font-semibold">{t("profilePage.bio")}</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={3}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
              />
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
          <div className="grid grid-cols-2 gap-6">
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
              <p className="text-gray-900 mt-2 font-medium">{profile.phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-600 font-semibold uppercase">
                {t("profilePage.bio")}
              </p>
              <p className="text-gray-900 mt-2 font-medium">{profile.bio}</p>
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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold">
                  {t("profilePage.postalCode")}
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-vr-500"
                />
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
          <div className="grid grid-cols-2 gap-6">
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
                {t("profilePage.postalCode")}
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
