import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";

const SharedTripReplacementNotice = memo(function SharedTripReplacementNotice() {
  const { t } = useTranslation("tripShare");

  return (
    <section
      aria-labelledby="shared-trip-replacement-heading"
      aria-live="polite"
      className="mb-3 rounded-[1.5rem] border border-[#E6A700]/35 bg-[#FFF8D8] px-4 py-4 text-[#5F4700] shadow-[0_18px_44px_-36px_rgba(121,89,0,0.55)] sm:px-5 lg:mb-4"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#8A6500] ring-1 ring-[#E6A700]/25">
          <FiRefreshCw className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="shared-trip-replacement-heading"
            className="text-sm font-extrabold text-[#5F4700] sm:text-base"
          >
            {t("replacement.title")}
          </h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-[#795900]">
            {t("replacement.description")}
          </p>
        </div>
      </div>
    </section>
  );
});

export default SharedTripReplacementNotice;
