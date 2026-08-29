// Xử lý chuyến ngay trong modal sự cố: hỏng xe thì thay xe + đổi kíp, tắc đường
// thì đổi lộ trình, không cứu được thì ghi nhận gián đoạn. Trước đây phải nhảy
// sang Trung tâm vận hành rồi tự mò đường quay lại đúng sự cố để đóng.
//
// Bản đồ và vị trí xe vẫn chỉ có ở Trung tâm vận hành, nên link sang đó ở cuối
// modal vẫn giữ — khối này chỉ cắt bớt đường vòng cho các ca đã rõ phải làm gì.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getOperatorTrips,
  getPublicTrip,
  type OperatorIncident,
  type OperatorTripListItem,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import { formatDateInputValue } from "../../../utils/date";
import TripActionsPanel from "../Operations/TripActionsPanel";

/**
 * Số trang tối đa quét để tìm chuyến. Đã lọc theo đúng ngày khởi hành + trạng
 * thái nên tập kết quả rất nhỏ; trần này chỉ để một nhà xe khổng lồ không kéo
 * cả nghìn chuyến chỉ vì mở một modal sự cố.
 */
const TRIP_LOOKUP_MAX_PAGES = 3;
const TRIP_LOOKUP_PAGE_SIZE = 100;

/**
 * `GET /v1/operator/trips` không lọc theo `tripId` và BE chưa có
 * `GET /v1/operator/trips/{tripId}` trả kèm kíp, nên lấy item danh sách bằng
 * cách thu hẹp theo ngày khởi hành + trạng thái rồi tìm trong đó.
 *
 * Item này mang `driver`/`assistant` — thứ mà `GET /v1/trips/{id}` (công khai)
 * không có, và handoff 2026-08-30 lại bắt loại kíp cũ khỏi bộ chọn kíp mới.
 */
async function findOperatorTrip(
  tripId: string,
  status: string,
  departureDateTime: string,
): Promise<OperatorTripListItem | null> {
  const departure = new Date(departureDateTime);
  const day = Number.isNaN(departure.getTime())
    ? null
    : formatDateInputValue(departure);

  for (let page = 1; page <= TRIP_LOOKUP_MAX_PAGES; page += 1) {
    const result = await getOperatorTrips({
      page,
      pageSize: TRIP_LOOKUP_PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(day ? { from: day, to: day } : {}),
    });

    const match = result.items.find((trip) => trip.tripId === tripId);
    if (match) return match;
    if (!result.hasNextPage) return null;
  }

  return null;
}

type IncidentTripActionsProps = {
  incident: OperatorIncident;
  vehicles: OperatorVehicle[];
  staff: OperatorUser[];
  /** Đã thử tải xe/nhân sự nhưng hỏng — form thay xe sẽ trống, phải nói ra */
  fleetFailed: boolean;
  /** Trang cha tải lại xe/nhân sự khi BE báo danh sách đã cũ */
  onResourcesStale?: () => void;
  /** Câu đã dịch của hành động vừa xong; màn cha dùng làm gợi ý ghi chú xử lý */
  onActionCompleted: (message: string) => void;
};

export default function IncidentTripActions({
  incident,
  vehicles,
  staff,
  fleetFailed,
  onResourcesStale,
  onActionCompleted,
}: IncidentTripActionsProps) {
  const { t } = useTranslation("manager");
  const tripId = incident.trip.tripId;

  // Endpoint chuyến công khai có `vehicleId`, đủ để loại đúng chiếc đang hỏng
  // khỏi danh sách xe thay thế kể cả khi tra danh sách nhà xe không ra.
  const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null);
  const [operatorTrip, setOperatorTrip] = useState<OperatorTripListItem | null>(
    null,
  );

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

  useEffect(() => {
    let ignore = false;
    findOperatorTrip(
      tripId,
      incident.trip.status,
      incident.trip.departureDateTime,
    )
      .then((trip) => {
        if (!ignore) setOperatorTrip(trip);
      })
      .catch(() => {
        // Không tra được kíp cũ thì panel không loại được họ khỏi bộ chọn —
        // BE vẫn chặn bằng `409 TRIP_CREW_SAME_AS_OLD`, không mất an toàn.
      });
    return () => {
      ignore = true;
    };
  }, [incident.trip.departureDateTime, incident.trip.status, tripId]);

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
        // Sự cố đang mở CHÍNH LÀ `incidentId` bắt buộc của request đổi xe —
        // khoá sẵn để không phải chọn lại (và không chọn nhầm sự cố khác).
        incidentId={incident.incidentId}
        trip={{
          status: incident.trip.status,
          routeId: incident.trip.route.routeId,
          vehicleId:
            currentVehicleId ?? operatorTrip?.vehicle.vehicleId ?? null,
          canSubstituteVehicle: operatorTrip?.canSubstituteVehicle,
          driverUserId: operatorTrip?.driver?.userId ?? null,
          assistantUserId: operatorTrip?.assistant?.userId ?? null,
          tripCode: operatorTrip?.tripCode ?? null,
          vehiclePlate: operatorTrip?.vehicle.licensePlate ?? null,
          vehicleStatus: operatorTrip?.vehicle.status ?? null,
          driverName: operatorTrip?.driver?.displayName ?? null,
          assistantName: operatorTrip?.assistant?.displayName ?? null,
        }}
        subtitle={t("incidents.tripActionsSubtitle")}
        vehicles={vehicles}
        staff={staff}
        canMutate
        onVehiclesStale={onResourcesStale}
        // Thay xe xong thì xe cũ đã sang `MAINTENANCE` — nạp lại để nó không
        // còn nằm trong ô chọn xe thay thế của lần sau.
        onSubstituted={() => onResourcesStale?.()}
        onActionCompleted={onActionCompleted}
      />
    </div>
  );
}
