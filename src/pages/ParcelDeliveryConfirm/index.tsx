import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCheck,
  FiLoader,
  FiPackage,
  FiRotateCcw,
  FiShield,
  FiXCircle,
} from "react-icons/fi";

import logo from "../../assets/Login/logo.svg";
import { createIdempotencyKey } from "../../api/idempotency";
import {
  confirmParcelDeliveryByToken,
  rejectParcelDeliveryByToken,
  undoRejectParcelDeliveryByToken,
  type ParcelActionResult,
} from "../../api/vietride";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import RejectDeliveryForm from "./RejectDeliveryForm";
import { classifyDeliveryError } from "./deliveryError";
import {
  readParcelDeliveryTokenFromWindow,
  stripParcelDeliveryTokenFromUrl,
} from "./deliveryToken";

type Phase = "idle" | "confirmed" | "rejected" | "blocked";
type PendingAction = "confirm" | "reject" | "undo";

const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-vr-800 px-5 py-3.5 text-base font-bold text-white shadow-sm shadow-vr-900/15 transition hover:bg-vr-900 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none";
const secondaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60";
const statusCircleClass =
  "mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full";
const headingClass = "mt-5 text-2xl font-bold text-slate-900 sm:text-3xl";
const descriptionClass =
  "mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600";

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Trang công khai `/parcels/delivery/confirm?token=<uuid>` — người nhận mở từ
 * email của nhà xe, KHÔNG cần đăng nhập.
 *
 * Idempotency: mỗi thao tác giữ một key cố định suốt vòng đời trang, mọi lần
 * "Thử lại" đều gửi lại đúng key đó nên BE replay kết quả cũ thay vì tạo thao
 * tác trùng. Key chỉ đổi khi nội dung request đổi (lý do từ chối) hoặc khi thao
 * tác trước đã bị hoàn tác.
 */
export default function ParcelDeliveryConfirmPage() {
  const { t, i18n } = useTranslation("parcelDelivery");
  const { t: tc } = useTranslation("common");
  const [token] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readParcelDeliveryTokenFromWindow(),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [result, setResult] = useState<ParcelActionResult | null>(null);
  const [alertKey, setAlertKey] = useState<string | null>(null);
  const [blockedKey, setBlockedKey] = useState<string>("errors.missingToken");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const confirmKeyRef = useRef<string | null>(null);
  const rejectKeyRef = useRef<{ key: string; reason: string } | null>(null);
  const undoKeyRef = useRef<string | null>(null);

  const locale = i18n.language?.startsWith("en") ? "en-US" : "vi-VN";
  const missingToken = token === null;

  useEffect(() => {
    document.title = t("documentTitle");

    // Token có quyền xác nhận đơn: chặn Referer rò link sang site khác và chặn
    // bot index URL kèm token.
    const referrerMeta = document.createElement("meta");
    referrerMeta.name = "referrer";
    referrerMeta.content = "no-referrer";
    const robotsMeta = document.createElement("meta");
    robotsMeta.name = "robots";
    robotsMeta.content = "noindex, nofollow, noarchive";
    document.head.append(referrerMeta, robotsMeta);

    return () => {
      referrerMeta.remove();
      robotsMeta.remove();
    };
  }, [t]);

  // Đã giữ token trong bộ nhớ thì bỏ khỏi URL — không để đọng trong lịch sử
  // trình duyệt hay ảnh chụp màn hình của người nhận.
  useEffect(() => {
    if (typeof window !== "undefined") {
      stripParcelDeliveryTokenFromUrl();
    }
  }, []);

  const parsedUndoDeadline = result?.canUndoUntil
    ? new Date(result.canUndoUntil).getTime()
    : Number.NaN;
  const undoDeadline = Number.isNaN(parsedUndoDeadline)
    ? null
    : parsedUndoDeadline;

  const undoRemainingMs = undoDeadline === null ? null : undoDeadline - now;
  const canUndo =
    phase === "rejected" &&
    undoAvailable &&
    (undoRemainingMs === null || undoRemainingMs > 0);

  useEffect(() => {
    if (phase !== "rejected" || undoDeadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase, undoDeadline]);

  const handleFailure = useCallback((error: unknown, action: PendingAction) => {
    const info = classifyDeliveryError(error);
    if (info.kind === "blocked") {
      // Hoàn tác hỏng thì đơn vẫn đang ở trạng thái từ chối — chỉ khoá nút
      // hoàn tác, không thay cả trang bằng màn hình lỗi.
      if (action === "undo") {
        setUndoAvailable(false);
        setAlertKey(info.messageKey);
        return;
      }
      setBlockedKey(info.messageKey);
      setPhase("blocked");
      return;
    }
    setAlertKey(info.messageKey);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!token || pending) return;
    confirmKeyRef.current ??= createIdempotencyKey();
    setPending("confirm");
    setAlertKey(null);
    try {
      const confirmed = await confirmParcelDeliveryByToken(
        { token },
        confirmKeyRef.current,
      );
      setResult(confirmed);
      setPhase("confirmed");
      setRejectOpen(false);
    } catch (error) {
      handleFailure(error, "confirm");
    } finally {
      setPending(null);
    }
  }, [handleFailure, pending, token]);

  const handleReject = useCallback(async () => {
    if (!token || pending) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError(t("reject.required"));
      return;
    }
    setReasonError(null);

    // Đổi lý do là đổi body → phải đổi key, nếu không BE trả
    // IDEMPOTENCY_KEY_MISMATCH.
    if (rejectKeyRef.current?.reason !== trimmedReason) {
      rejectKeyRef.current = {
        key: createIdempotencyKey(),
        reason: trimmedReason,
      };
    }

    setPending("reject");
    setAlertKey(null);
    try {
      const rejected = await rejectParcelDeliveryByToken(
        { token, rejectionReason: trimmedReason },
        rejectKeyRef.current.key,
      );
      setResult(rejected);
      setPhase("rejected");
      setRejectOpen(false);
      setUndoAvailable(true);
      undoKeyRef.current = null;
      setNow(Date.now());
    } catch (error) {
      handleFailure(error, "reject");
    } finally {
      setPending(null);
    }
  }, [handleFailure, pending, reason, t, token]);

  const handleUndo = useCallback(async () => {
    if (!token || pending) return;
    undoKeyRef.current ??= createIdempotencyKey();
    setPending("undo");
    setAlertKey(null);
    try {
      await undoRejectParcelDeliveryByToken({ token }, undoKeyRef.current);
      setResult(null);
      setPhase("idle");
      setAlertKey("rejected.undone");
      setReason("");
      // Lần từ chối kế tiếp là một thao tác mới → key mới.
      rejectKeyRef.current = null;
      undoKeyRef.current = null;
    } catch (error) {
      handleFailure(error, "undo");
    } finally {
      setPending(null);
    }
  }, [handleFailure, pending, token]);

  const showActions = phase === "idle" && !missingToken;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-vr-500 px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <section className="w-full max-w-xl rounded-[1.75rem] bg-slate-50 px-7 py-9 text-center shadow-xl sm:px-12 sm:py-12">
        <img
          src={logo}
          alt={tc("brand")}
          className="mx-auto h-20 w-20 object-contain"
        />

        {missingToken || phase === "blocked" ? (
          <>
            <div className={`${statusCircleClass} bg-red-100 text-red-600`}>
              <FiAlertCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className={headingClass}>{t("errors.title")}</h1>
            <p className={descriptionClass}>
              {t(missingToken ? "errors.missingToken" : blockedKey)}
            </p>
          </>
        ) : phase === "confirmed" ? (
          <>
            <div className={`${statusCircleClass} bg-emerald-100 text-emerald-700`}>
              <FiCheck className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className={headingClass}>{t("confirmed.title")}</h1>
            <p className={descriptionClass}>{t("confirmed.description")}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {t("confirmed.at", {
                time: formatDateTime(result?.confirmedAt, locale),
              })}
            </p>
          </>
        ) : phase === "rejected" ? (
          <>
            <div className={`${statusCircleClass} bg-amber-100 text-amber-700`}>
              <FiXCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className={headingClass}>{t("rejected.title")}</h1>
            <p className={descriptionClass}>{t("rejected.description")}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {t("rejected.at", {
                time: formatDateTime(result?.rejectedAt, locale),
              })}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {canUndo && undoRemainingMs !== null
                ? t("rejected.undoWindow", {
                    time: formatCountdown(undoRemainingMs),
                  })
                : t("rejected.undoExpired")}
            </p>
            {canUndo ? (
              <button
                type="button"
                onClick={handleUndo}
                disabled={pending !== null}
                className={`${secondaryButtonClass} mt-6`}
              >
                {pending === "undo" ? (
                  <FiLoader className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <FiRotateCcw className="h-5 w-5" aria-hidden="true" />
                )}
                {pending === "undo" ? t("actions.undoing") : t("actions.undo")}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className={`${statusCircleClass} bg-vr-100 text-vr-800`}>
              <FiPackage className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className={headingClass}>{t("heading")}</h1>
            <p className={descriptionClass}>{t("intro")}</p>
          </>
        )}

        {alertKey ? (
          <p
            role="status"
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium leading-6 text-amber-900"
          >
            {t(alertKey)}
          </p>
        ) : null}

        {showActions ? (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending !== null}
              className={primaryButtonClass}
            >
              {pending === "confirm" ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <FiCheck className="h-5 w-5" aria-hidden="true" />
              )}
              {pending === "confirm"
                ? t("actions.confirming")
                : t("actions.confirm")}
            </button>

            {rejectOpen ? (
              <RejectDeliveryForm
                reason={reason}
                onReasonChange={setReason}
                onSubmit={() => void handleReject()}
                onCancel={() => {
                  setRejectOpen(false);
                  setReasonError(null);
                }}
                submitting={pending === "reject"}
                error={reasonError}
              />
            ) : (
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={pending !== null}
                className={secondaryButtonClass}
              >
                {t("actions.reject")}
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-vr-200 bg-vr-50 p-5 text-left">
          <div className="flex items-center gap-3 font-semibold text-vr-800">
            <FiShield className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t("privacy.title")}</span>
          </div>
          <p className="mt-2 pl-8 text-sm leading-6 text-slate-600">
            {t("privacy.note")}
          </p>
        </div>

        <p className="mt-5 text-sm text-gray-500">{t("support")}</p>
      </section>
    </main>
  );
}
