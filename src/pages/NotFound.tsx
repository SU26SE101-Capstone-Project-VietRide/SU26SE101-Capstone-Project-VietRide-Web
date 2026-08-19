import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FiCompass } from "react-icons/fi";
import { getAuthUser, getHomePathForRole } from "../auth";
import { EmptyState } from "../components/ui/EmptyState";

/**
 * Trang 404 thật, thay cho việc đá âm thầm mọi URL sai về dashboard.
 *
 * Redirect im lặng khiến người gõ nhầm địa chỉ (hoặc mở một link đã chết)
 * tưởng mình vẫn đang ở đúng chỗ — không có tín hiệu nào cho biết đường dẫn
 * vừa mở không tồn tại.
 */
export default function NotFound() {
  const { t } = useTranslation("common");
  const user = getAuthUser();
  const homePath = user ? getHomePathForRole(user.role) : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg">
        <EmptyState
          icon={<FiCompass size={26} />}
          title={t("notFoundTitle")}
          description={t("notFoundDescription")}
          action={
            <Link
              to={homePath}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-vr-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-vr-900"
            >
              {t("notFoundBackHome")}
            </Link>
          }
        />
      </div>
    </main>
  );
}
