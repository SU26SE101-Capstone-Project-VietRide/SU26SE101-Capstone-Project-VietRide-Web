// State hàng đợi yêu cầu gói riêng của admin: tải danh sách, duyệt, từ chối.
//
// Duyệt là hành động dựng ra một GÓI MỚI (private, thuộc đúng nhà xe đã xin) —
// không phải nâng cấp giúp họ. Sau khi duyệt, nhà xe vẫn phải tự đi luồng báo
// giá → thanh toán như mua gói tiêu chuẩn.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import {
  approveAdminCustomPlanRequest,
  getAdminCustomPlanRequests,
  rejectAdminCustomPlanRequest,
  type ApproveCustomPlanRequestPayload,
} from "../../../api/vietride";
import {
  toCustomPlanRequestView,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// Lỗi theo từng ô của form duyệt — BE trả `error.fields` khi hạn mức duyệt thấp
// hơn mức nhà xe đang dùng (422 CUSTOM_PLAN_LIMIT_BELOW_CURRENT_USAGE)
export type CustomPlanFieldErrors = Record<string, string>;

export function useCustomPlanRequests(t: TranslateFn) {
  const [requests, setRequests] = useState<CustomPlanRequestView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CustomPlanFieldErrors>({});

  // `t` từ useTranslation đổi identity khi đổi ngôn ngữ. Để nó trong deps của
  // `load` thì effect gọi load sẽ bắn lại mỗi lần đổi ngôn ngữ — tải lại danh
  // sách chỉ vì user bấm VI/EN. Giữ qua ref để `load` ổn định.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      // Chuẩn hoá NGAY tại cửa vào — component không bao giờ chạm shape thô
      setRequests((await getAdminCustomPlanRequests()).map(toCustomPlanRequestView));
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("customPlans.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pendingCount = useMemo(
    () =>
      requests.filter((request) => request.status === "PENDING_REVIEW").length,
    [requests],
  );

  function clearFieldErrors() {
    setFieldErrors({});
  }

  // Trả về true khi thành công — nơi gọi dùng để đóng modal
  async function approve(
    requestId: string,
    payload: ApproveCustomPlanRequestPayload,
  ) {
    setIsSaving(true);
    setError("");
    setFieldErrors({});

    try {
      await approveAdminCustomPlanRequest(requestId, payload);
      setMessage(t("customPlans.approveSuccess"));
      await load();
      return true;
    } catch (err) {
      // Hạn mức duyệt thấp hơn usage → gắn lỗi vào ĐÚNG ô, đừng bắt admin tự
      // dò xem con số nào sai
      if (err instanceof ApiRequestError && err.fields.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            err.fields.map((field) => [field.field, field.message]),
          ),
        );
      }

      setError(
        err instanceof Error ? err.message : t("customPlans.approveFailed"),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function reject(requestId: string, reason: string) {
    setIsSaving(true);
    setError("");

    try {
      await rejectAdminCustomPlanRequest(requestId, { reason });
      setMessage(t("customPlans.rejectSuccess"));
      await load();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("customPlans.rejectFailed"),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    requests,
    pendingCount,
    isLoading,
    isSaving,
    error,
    message,
    fieldErrors,
    load,
    approve,
    reject,
    clearFieldErrors,
  };
}

export type UseCustomPlanRequestsResult = ReturnType<
  typeof useCustomPlanRequests
>;
