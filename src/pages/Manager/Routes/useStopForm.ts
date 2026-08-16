// Hook cục bộ: form chọn/xem điểm dừng (stop) của màn Routes — chỉ còn
// handleSelectStop (đổ dữ liệu stop đã chọn vào form) sau khi dọn dead code:
// tạo/sửa stop thủ công qua form số đã được thay bằng flow gợi ý điểm dừng
// trên bản đồ (StopSearchBox + addStopFromSuggestion), không còn UI nào gọi
// handleCreateStop/handleUpdateStop nữa.
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  getOperatorStop,
  type OperatorStop,
  type OperatorStopRequest,
} from "../../../api/vietride";
import { emptyStopForm } from "./routeFormUtils";

type UseStopFormParams = {
  setSelectedStopId: Dispatch<SetStateAction<string>>;
  setStops: Dispatch<SetStateAction<OperatorStop[]>>;
};

export function useStopForm({
  setSelectedStopId,
  setStops,
}: UseStopFormParams) {
  const [stopForm, setStopForm] = useState<OperatorStopRequest>(emptyStopForm);
  // Chống race khi chọn điểm dừng (cùng pattern chọn tuyến): response về muộn
  // của lần chọn cũ bị bỏ qua, không đè form của điểm dừng đang chọn
  const selectStopSeqRef = useRef(0);

  async function handleSelectStop(stopId: string) {
    const seq = ++selectStopSeqRef.current;
    setSelectedStopId(stopId);

    if (!stopId) {
      setStopForm(emptyStopForm);
      return;
    }

    const stop = await getOperatorStop(stopId);

    // Trong lúc chờ user đã chọn điểm dừng khác → bỏ qua response cũ
    if (seq !== selectStopSeqRef.current) {
      return;
    }

    setStops((prev) =>
      prev.some((item) => item.id === stop.id)
        ? prev.map((item) => (item.id === stop.id ? stop : item))
        : [stop, ...prev],
    );
    setStopForm({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      description: stop.description ?? "",
      address: stop.address ?? "",
      googlePlaceId: stop.googlePlaceId,
    });
  }

  return {
    stopForm,
    setStopForm,
    handleSelectStop,
  };
}

