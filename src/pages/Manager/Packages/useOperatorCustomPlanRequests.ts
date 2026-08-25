// State yêu cầu gói riêng phía nhà xe: lịch sử + gửi yêu cầu mới.
//
// Nhắc lại ranh giới dễ nhầm: yêu cầu này chỉ dựng ra một GÓI MỚI trong bảng
// giá. Duyệt xong nhà xe vẫn đang ở gói cũ và vẫn trả giá cũ — muốn lên gói
// riêng thì đi tiếp luồng báo giá → thanh toán như mọi gói tiêu chuẩn.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import {
  createOperatorCustomPlanRequest,
  getOperatorCustomPlanRequests,
  type CreateCustomPlanRequestPayload,
} from "../../../api/vietride";
import {
  toCustomPlanRequestView,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function sentAtMs(request: CustomPlanRequestView) {
  const parsed = Date.parse(request.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useOperatorCustomPlanRequests(t: TranslateFn) {
  const [requests, setRequests] = useState<CustomPlanRequestView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      setRequests(
        (await getOperatorCustomPlanRequests()).map(toCustomPlanRequestView),
      );
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("packages.customRequestLoadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Yêu cầu mới nhất quyết định nội dung khối trạng thái trên màn
  const latestRequest = useMemo(
    () =>
      requests.length === 0
        ? null
        : [...requests].sort((first, second) => sentAtMs(second) - sentAtMs(first))[0],
    [requests],
  );

  const pendingRequest = useMemo(
    () =>
      requests.find((request) => request.status === "PENDING_REVIEW") ?? null,
    [requests],
  );

  // Trả về true khi gửi xong — nơi gọi dùng để đóng form
  async function submit(payload: CreateCustomPlanRequestPayload) {
    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      await createOperatorCustomPlanRequest(payload);
      await load();
      setNotice(t("packages.customRequestSent"));
      return true;
    } catch (err) {
      // Mỗi nhà xe chỉ được một yêu cầu chờ duyệt. Gặp 409 thì họ chỉ đang mở
      // hai tab — tải lại để khối trạng thái hiện yêu cầu đang chờ, rồi đóng
      // form. Bắn lỗi đỏ để họ tự đoán là vô ích.
      if (
        err instanceof ApiRequestError &&
        err.code === "CUSTOM_REQUEST_ALREADY_PENDING"
      ) {
        await load();
        setNotice(t("packages.customRequestAlreadyPending"));
        return true;
      }

      setError(
        err instanceof Error ? err.message : t("packages.customRequestFailed"),
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    requests,
    latestRequest,
    pendingRequest,
    isLoading,
    isSubmitting,
    error,
    notice,
    load,
    submit,
    clearFeedback: () => {
      setError("");
      setNotice("");
    },
  };
}

export type UseOperatorCustomPlanRequestsResult = ReturnType<
  typeof useOperatorCustomPlanRequests
>;
