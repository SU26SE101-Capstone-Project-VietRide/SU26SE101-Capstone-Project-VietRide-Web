// Xử lý chuyến ngay trong modal sự cố: hỏng xe thì thay xe + đổi kíp, tắc đường
// thì đổi lộ trình, không cứu được thì ghi nhận gián đoạn. Trước đây phải nhảy
// sang Trung tâm vận hành rồi tự mò đường quay lại đúng sự cố để đóng.
//
// Bản đồ và vị trí xe vẫn chỉ có ở Trung tâm vận hành, nên link sang đó ở cuối
// modal vẫn giữ — khối này chỉ cắt bớt đường vòng cho các ca đã rõ phải làm gì.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPublicTrip,
  type OperatorIncident,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import TripActionsPanel from "../Operations/TripActionsPanel";

type IncidentTripActionsProps = {
  incident: OperatorIncident;
  vehicles: OperatorVehicle[];
  staff: OperatorUser[];
  /** Đã thử tải xe/nhân sự nhưng hỏng — form thay xe sẽ trống, phải nói ra */
  fleetFailed: boolean;
  /** Câu đã dịch của hành động vừa xong; màn cha dùng làm gợi ý ghi chú xử lý */
  onActionCompleted: (message: string) => void;
};

export default function IncidentTripActions({
  incident,
  vehicles,
  staff,
  fleetFailed,
  onActionCompleted,
}: IncidentTripActionsProps) {
  const { t } = useTranslation("manager");
  const tripId = incident.trip.tripId;

  // `GET /v1/operator/trips` không lọc theo tripId nên không lấy được xe hiện
  // tại của một chuyến lẻ từ đó. Endpoint chuyến công khai có `vehicleId`, đủ
  // để loại đúng chiếc đang hỏng khỏi danh sách xe thay thế.
  const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getPublicTrip(tripId)
      .then((trip) => {
        if (!ignore) setCurrentVehicleId(trip.vehicleId ?? null);
      })
      .catch(() => {
        // Không lấy được thì chỉ mất bộ lọc xe; form vẫn dùng bình thường
      });
    return () => {
      ignore = true;
    };
  }, [tripId]);

  return (
    <div className="space-y-3">
      {fleetFailed && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {t("incidents.tripActionsFleetFailed")}
        </p>
      )}
      <TripActionsPanel
        // Đổi sự cố là đổi chuyến — remount để xoá form/kết quả của chuyến trước
        key={tripId}
        tripId={tripId}
        trip={{
          status: incident.trip.status,
          routeId: incident.trip.route.routeId,
          vehicleId: currentVehicleId,
          // `canSubstituteVehicle` cố tình bỏ trống: BE chưa có
          // `GET /v1/operator/trips/{tripId}` nên không lấy được cờ này cho một
          // chuyến lẻ. Bỏ trống = chưa biết, panel không khoá sẵn nút Thay xe và
          // để BE từ chối nếu chuyến không đủ điều kiện.
        }}
        subtitle={t("incidents.tripActionsSubtitle")}
        vehicles={vehicles}
        staff={staff}
        canMutate
        onActionCompleted={onActionCompleted}
      />
    </div>
  );
}
