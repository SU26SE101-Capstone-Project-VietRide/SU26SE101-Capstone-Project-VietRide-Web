import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { FiClock, FiRefreshCw, FiUsers } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  createOperatorShuttleTrip,
  getOperatorShuttleRequests,
  getOperatorUsers,
  getOperatorVehicles,
  getShuttleTripEta,
  getShuttleTripLatest,
  type OperatorUser,
  type OperatorVehicle,
  type PagedResult,
  type ShuttleDirection,
  type ShuttleRequestGroup,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import {
  addRecentShuttleTrip,
  getRecentShuttleTrips,
  removeRecentShuttleTrip,
} from "../../../utils/shuttleTrackingHistory";
import AssignVehicleModal, {
  type AssignVehicleForm,
} from "./AssignVehicleModal";
import RequestDetailModal from "./RequestDetailModal";
import RequestTable from "./RequestTable";
import ShuttleTrackingCard from "./ShuttleTrackingCard";
import {
  buildInitialSchedule,
  getBookingDistance,
  getOrderedBookingGroups,
  getOrderedSelectedBookingIds,
  getSelectedPassengerCount,
  isInboundDirection,
  toDriverOption,
  toVehicleOption,
  type ShuttleDriver,
  type ShuttleVehicle,
  type TrackedShuttleTrip,
} from "./dispatchHelpers";

const REQUEST_PAGE_SIZE = 8;
const RESOURCE_PAGE_SIZE = 50;

const EMPTY_ASSIGN_FORM: AssignVehicleForm = {
  vehicleId: "",
  driverId: "",
  scheduledDepartureTime: "",
  scheduledEndTime: "",
  selectedBookingIds: [],
  notes: "",
};

async function loadEveryPage<T>(
  loadPage: (page: number) => Promise<PagedResult<T>>,
) {
  const firstPage = await loadPage(1);
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await loadPage(page);
    items.push(...result.items);
  }

  return items;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export default function DispatchPanel() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const authUser = getAuthUser();
  const canDispatchShuttle = authUser?.role === "OPERATOR_ADMIN";
  const tRef = useRef(t);

  const [searchParams] = useSearchParams();
  const linkedShuttleTripId = searchParams.get("shuttleTripId");
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [groups, setGroups] = useState<ShuttleRequestGroup[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  const [vehicles, setVehicles] = useState<ShuttleVehicle[]>([]);
  const [drivers, setDrivers] = useState<ShuttleDriver[]>([]);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const resourcesLoadingRef = useRef(false);

  const [openAssignVehicle, setOpenAssignVehicle] = useState(false);
  const [openRequestDetail, setOpenRequestDetail] = useState(false);
  const [selectedGroup, setSelectedGroup] =
    useState<ShuttleRequestGroup | null>(null);
  const [assignForm, setAssignForm] =
    useState<AssignVehicleForm>(EMPTY_ASSIGN_FORM);
  const [assignError, setAssignError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useToastFeedback({ message, error: loadError || resourceError || assignError });
  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [trackedShuttleTrips, setTrackedShuttleTrips] = useState<
    TrackedShuttleTrip[]
  >(() =>
    getRecentShuttleTrips().map((item) => ({
      ...item,
      isRefreshing: false,
    })),
  );

  const directionLabel = useCallback(
    (direction: ShuttleDirection) =>
      isInboundDirection(direction)
        ? t("dispatch.pickup")
        : t("dispatch.dropoff"),
    [t],
  );

  useEffect(() => {
    let ignore = false;

    async function loadRequests() {
      setIsLoading(true);
      setLoadError("");

      try {
        const result = await getOperatorShuttleRequests({
          page,
          pageSize: REQUEST_PAGE_SIZE,
        });

        if (ignore) {
          return;
        }

        const lastPage = Math.max(
          1,
          Math.ceil(result.totalItems / REQUEST_PAGE_SIZE),
        );
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setGroups(result.items);
        setTotalItems(result.totalItems);
      } catch (error) {
        if (!ignore) {
          setLoadError(
            error instanceof Error
              ? error.message
              : tRef.current("dispatch.loadFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadRequests();
    return () => {
      ignore = true;
    };
  }, [page, refreshVersion]);

  const loadAssignmentResources = useCallback(
    async (force = false) => {
      if (!canDispatchShuttle || resourcesLoadingRef.current) {
        return;
      }

      if (resourcesLoaded && !force) {
        return;
      }

      resourcesLoadingRef.current = true;
      setIsLoadingResources(true);
      setResourceError("");

      try {
        const [vehicleItems, userItems] = await Promise.all([
          loadEveryPage<OperatorVehicle>((resourcePage) =>
            getOperatorVehicles({
              page: resourcePage,
              pageSize: RESOURCE_PAGE_SIZE,
              status: "ACTIVE",
              sortBy: "licensePlate",
              sortDir: "asc",
            }),
          ),
          loadEveryPage<OperatorUser>((resourcePage) =>
            getOperatorUsers({
              page: resourcePage,
              pageSize: RESOURCE_PAGE_SIZE,
              role: "DRIVER",
              status: "ACTIVE",
              sortBy: "displayName",
              sortDir: "asc",
            }),
          ),
        ]);

        const nextVehicles = uniqueById(
          vehicleItems
            .map(toVehicleOption)
            .filter((vehicle): vehicle is ShuttleVehicle => vehicle !== null),
        );
        const nextDrivers = uniqueById(
          userItems
            .map(toDriverOption)
            .filter((driver): driver is ShuttleDriver => driver !== null),
        );

        setVehicles(nextVehicles);
        setDrivers(nextDrivers);
        setResourcesLoaded(true);
        setAssignForm((current) => ({
          ...current,
          vehicleId: nextVehicles.some(
            (vehicle) => vehicle.id === current.vehicleId,
          )
            ? current.vehicleId
            : nextVehicles[0]?.id || "",
          driverId: nextDrivers.some(
            (driver) => driver.id === current.driverId,
          )
            ? current.driverId
            : nextDrivers[0]?.id || "",
        }));
      } catch (error) {
        setResourceError(
          error instanceof Error
            ? error.message
            : t("dispatch.resourceLoadFailed", {
                defaultValue: "Không thể tải danh sách xe và tài xế.",
              }),
        );
      } finally {
        resourcesLoadingRef.current = false;
        setIsLoadingResources(false);
      }
    },
    [canDispatchShuttle, resourcesLoaded, t],
  );

  const refreshShuttleTracking = useCallback(
    async (shuttleTripId: string) => {
      setTrackedShuttleTrips((current) =>
        current.map((item) =>
          item.shuttleTripId === shuttleTripId
            ? { ...item, isRefreshing: true, error: undefined }
            : item,
        ),
      );

      try {
        const [latest, eta] = await Promise.all([
          getShuttleTripLatest(shuttleTripId),
          getShuttleTripEta(shuttleTripId),
        ]);
        setTrackedShuttleTrips((current) =>
          current.map((item) =>
            item.shuttleTripId === shuttleTripId
              ? { ...item, latest, eta, isRefreshing: false }
              : item,
          ),
        );
      } catch (error) {
        setTrackedShuttleTrips((current) =>
          current.map((item) =>
            item.shuttleTripId === shuttleTripId
              ? {
                  ...item,
                  isRefreshing: false,
                  error:
                    error instanceof ApiRequestError &&
                    error.code === "TRACKING_ACCESS_DENIED"
                      ? t("dispatch.operatorTrackingDenied")
                      : error instanceof Error
                        ? error.message
                        : t("dispatch.trackingFailed"),
                }
              : item,
          ),
        );
      }
    },
    [t],
  );


  useEffect(() => {
    const shuttleTripId = linkedShuttleTripId?.trim();
    if (!shuttleTripId) return;

    setTrackedShuttleTrips((current) => {
      if (current.some((item) => item.shuttleTripId === shuttleTripId)) return current;
      return [
        {
          shuttleTripId,
          mainTripId: "-",
          createdAt: new Date().toISOString(),
          isRefreshing: false,
        },
        ...current,
      ];
    });
    void refreshShuttleTracking(shuttleTripId);
  }, [linkedShuttleTripId, refreshShuttleTracking]);
  const removeShuttleTracking = useCallback((shuttleTripId: string) => {
    removeRecentShuttleTrip(shuttleTripId);
    setTrackedShuttleTrips((current) =>
      current.filter((item) => item.shuttleTripId !== shuttleTripId),
    );
  }, []);

  function openDetail(group: ShuttleRequestGroup) {
    setSelectedGroup(group);
    setOpenRequestDetail(true);
  }

  function openAssign(group: ShuttleRequestGroup) {
    if (!canDispatchShuttle) {
      return;
    }

    const schedule = buildInitialSchedule(group);
    const selectedBookingIds = getOrderedBookingGroups(group)
      .filter((booking) => getBookingDistance(booking) !== null)
      .map((booking) => booking.bookingId);

    setSelectedGroup(group);
    setAssignError("");
    setResourceError("");
    setAssignForm({
      vehicleId: vehicles[0]?.id || "",
      driverId: drivers[0]?.id || "",
      selectedBookingIds,
      notes: "",
      ...schedule,
    });
    idempotencyKeyRef.current = createIdempotencyKey();
    setOpenAssignVehicle(true);
    void loadAssignmentResources();
  }

  function closeAssign() {
    if (isSubmittingRef.current) {
      return;
    }

    setOpenAssignVehicle(false);
    setAssignError("");
    idempotencyKeyRef.current = null;
  }

  function getAssignmentValidationError() {
    if (!selectedGroup) {
      return t("dispatch.invalidRequest", {
        defaultValue: "Nhóm yêu cầu không còn hợp lệ.",
      });
    }

    const orderedBookingIds = getOrderedSelectedBookingIds(
      selectedGroup,
      assignForm.selectedBookingIds,
    );
    if (orderedBookingIds.length === 0) {
      return t("dispatch.selectAtLeastOneBooking", {
        defaultValue: "Chọn ít nhất một lượt đặt vé để điều phối.",
      });
    }

    if (
      orderedBookingIds.some((bookingId) => {
        const booking = selectedGroup.bookingGroups.find(
          (item) => item.bookingId === bookingId,
        );
        return !booking || getBookingDistance(booking) === null;
      })
    ) {
      return t("dispatch.distanceRequired", {
        defaultValue:
          "Không thể điều phối lượt đặt vé chưa có khoảng cách đường bộ.",
      });
    }

    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === assignForm.vehicleId,
    );
    if (!selectedVehicle) {
      return t("dispatch.selectVehiclePlaceholder");
    }

    if (!drivers.some((driver) => driver.id === assignForm.driverId)) {
      return t("dispatch.selectDriverPlaceholder");
    }

    const passengerCount = getSelectedPassengerCount(
      selectedGroup,
      orderedBookingIds,
    );
    if (passengerCount > selectedVehicle.capacity) {
      return t("dispatch.capacityExceeded", {
        defaultValue:
          "Số khách đã chọn vượt quá sức chứa {{capacity}} chỗ của xe.",
        capacity: selectedVehicle.capacity,
      });
    }

    const departure = new Date(assignForm.scheduledDepartureTime);
    const end = new Date(assignForm.scheduledEndTime);
    if (
      !assignForm.scheduledDepartureTime ||
      !assignForm.scheduledEndTime ||
      Number.isNaN(departure.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return t("dispatch.fillRequired");
    }

    if (departure.getTime() <= Date.now()) {
      return t("dispatch.departureMustBeFuture", {
        defaultValue: "Giờ xuất phát trung chuyển phải ở tương lai.",
      });
    }

    if (end <= departure) {
      return t("dispatch.endAfterDeparture", {
        defaultValue: "Giờ kết thúc phải sau giờ xuất phát.",
      });
    }

    const boundary = new Date(selectedGroup.hardCutoffAt);
    if (!Number.isNaN(boundary.getTime())) {
      if (
        isInboundDirection(selectedGroup.direction) &&
        Date.now() >= boundary.getTime()
      ) {
        return t("dispatch.cutoffPassed", {
          defaultValue: "Đã quá hạn điều phối.",
        });
      }

      if (
        isInboundDirection(selectedGroup.direction) &&
        end.getTime() > boundary.getTime()
      ) {
        return t("dispatch.endBeforeCutoff", {
          defaultValue:
            "Chuyến trung chuyển phải kết thúc trước hạn của chuyến chính.",
        });
      }

      if (
        !isInboundDirection(selectedGroup.direction) &&
        departure.getTime() < boundary.getTime()
      ) {
        return t("dispatch.departureAfterBoundary", {
          defaultValue:
            "Chuyến trả khách chỉ được xuất phát sau thời điểm chuyến chính đến bến.",
        });
      }
    }

    if (assignForm.notes.length > 1_000) {
      return t("dispatch.notesTooLong", {
        defaultValue: "Ghi chú không được vượt quá 1.000 ký tự.",
      });
    }

    return null;
  }

  function getSubmitError(error: unknown) {
    if (!(error instanceof ApiRequestError)) {
      return error instanceof Error ? error.message : t("dispatch.assignFailed");
    }

    const messages: Record<string, string> = {
      SHUTTLE_REQUEST_CUTOFF_PASSED: t("dispatch.cutoffPassed", {
        defaultValue: "Đã quá hạn điều phối.",
      }),
      SHUTTLE_DRIVER_CONFLICT: t("dispatch.driverConflict", {
        defaultValue: "Tài xế đã có chuyến trùng thời gian.",
      }),
      SHUTTLE_VEHICLE_CONFLICT: t("dispatch.vehicleConflict", {
        defaultValue: "Xe đã có chuyến trùng thời gian hoặc không còn hoạt động.",
      }),
      SHUTTLE_REQUEST_SET_CHANGED: t("dispatch.requestSetChanged", {
        defaultValue:
          "Danh sách yêu cầu vừa thay đổi. Hãy đóng biểu mẫu và tải lại trang.",
      }),
      SHUTTLE_CAPACITY_EXCEEDED: t("dispatch.capacityChanged", {
        defaultValue: "Sức chứa xe không còn đủ cho số khách đã chọn.",
      }),
      SHUTTLE_DISTANCE_UNAVAILABLE: t("dispatch.distanceRequired", {
        defaultValue: "Một điểm đón/trả chưa có khoảng cách đường bộ.",
      }),
      SHUTTLE_DISTANCE_EXCEEDED: t("dispatch.distanceExceeded", {
        defaultValue: "Một điểm đón/trả vượt quá phạm vi trung chuyển.",
      }),
      DRIVER_NOT_FOUND: t("dispatch.driverUnavailable", {
        defaultValue: "Tài xế không còn sẵn sàng để điều phối.",
      }),
      VEHICLE_NOT_FOUND: t("dispatch.vehicleUnavailable", {
        defaultValue: "Xe không còn sẵn sàng để điều phối.",
      }),
    };

    return (error.code && messages[error.code]) || error.message;
  }

  async function handleAssignVehicle() {
    if (isSubmittingRef.current || !selectedGroup) {
      return;
    }

    const validationError = getAssignmentValidationError();
    if (validationError) {
      setAssignError(validationError);
      return;
    }

    const orderedBookingIds = getOrderedSelectedBookingIds(
      selectedGroup,
      assignForm.selectedBookingIds,
    );
    const idempotencyKey =
      idempotencyKeyRef.current ?? createIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setAssignError("");

    try {
      const result = await createOperatorShuttleTrip(
        {
          mainTripId: selectedGroup.mainTripId,
          direction: selectedGroup.direction,
          vehicleId: assignForm.vehicleId,
          driverUserId: assignForm.driverId,
          scheduledDepartureTime: new Date(
            assignForm.scheduledDepartureTime,
          ).toISOString(),
          scheduledEndTime: new Date(
            assignForm.scheduledEndTime,
          ).toISOString(),
          orderedBookingIds,
          notes: assignForm.notes.trim() || undefined,
        },
        idempotencyKey,
      );

      const createdAt = new Date().toISOString();
      const trackingEntry: TrackedShuttleTrip = {
        shuttleTripId: result.shuttleTripId,
        mainTripId: result.mainTripId,
        createdAt,
        isRefreshing: false,
      };
      addRecentShuttleTrip(trackingEntry);
      setTrackedShuttleTrips((current) => [
        trackingEntry,
        ...current.filter(
          (item) => item.shuttleTripId !== result.shuttleTripId,
        ),
      ]);
      setMessage(
        t("dispatch.assignSuccessDetail", {
          defaultValue:
            "Đã tạo chuyến trung chuyển {{tripId}} cho {{count}} khách.",
          tripId: result.shuttleTripId,
          count: result.assignedPassengerCount,
        }),
      );
      setOpenAssignVehicle(false);
      setSelectedGroup(null);
      setAssignForm(EMPTY_ASSIGN_FORM);
      idempotencyKeyRef.current = null;
      if (page === 1) {
        setRefreshVersion((current) => current + 1);
      } else {
        setPage(1);
      }
      void refreshShuttleTracking(result.shuttleTripId);
    } catch (error) {
      setAssignError(getSubmitError(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const passengersOnPage = useMemo(
    () =>
      groups.reduce(
        (total, group) => total + group.pendingPassengerCount,
        0,
      ),
    [groups],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("dispatch.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("dispatch.pendingSubtitle", {
              defaultValue:
                "Điều phối các nhóm yêu cầu đang chờ theo chuyến chính và chiều trung chuyển.",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setRefreshVersion((current) => current + 1);
          }}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw
            size={18}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {tc("refresh")}
        </button>
      </div>

      {!canDispatchShuttle && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {t("dispatch.staffReadOnly", {
            defaultValue:
              "Nhân viên có thể theo dõi các yêu cầu chờ. Chỉ quản trị viên nhà xe được phân công xe và tài xế.",
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("dispatch.pendingGroups", {
            defaultValue: "Nhóm yêu cầu đang chờ",
          })}
          value={totalItems}
          icon={<FiClock size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label={t("dispatch.passengersOnPage", {
            defaultValue: "Khách chờ trên trang hiện tại",
          })}
          value={passengersOnPage}
          icon={<FiUsers size={20} />}
          iconClassName="bg-vr-50 text-vr-700"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-gray-900">
            {t("dispatch.awaiting")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t("dispatch.serverPaginationHint", {
              defaultValue:
                "Danh sách được phân trang trực tiếp từ hệ thống; mỗi thẻ là một chuyến chính và một chiều trung chuyển.",
            })}
          </p>
        </div>

        <RequestTable
          groups={groups}
          isLoading={isLoading}
          canDispatchShuttle={canDispatchShuttle}
          onAssign={openAssign}
          onOpenDetail={openDetail}
          directionLabel={directionLabel}
        />

        <Pagination
          page={page}
          pageSize={REQUEST_PAGE_SIZE}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("dispatch.shuttleTracking")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("dispatch.shuttleTrackingBrowserHint", {
            defaultValue:
              "Các chuyến trung chuyển gần đây được lưu trên trình duyệt này. Chỉ tải vị trí khi bạn yêu cầu.",
          })}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {trackedShuttleTrips.map((item) => (
            <ShuttleTrackingCard
              key={item.shuttleTripId}
              item={item}
              onRefresh={(shuttleTripId) =>
                void refreshShuttleTracking(shuttleTripId)
              }
              onRemove={removeShuttleTracking}
            />
          ))}
          {trackedShuttleTrips.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
              {t("dispatch.shuttleTrackingEmpty")}
            </p>
          )}
        </div>
      </section>

      <AssignVehicleModal
        open={openAssignVehicle}
        onClose={closeAssign}
        group={selectedGroup}
        vehicles={vehicles}
        drivers={drivers}
        form={assignForm}
        onFormChange={(nextForm) => {
          setAssignError("");
          setAssignForm(nextForm);
        }}
        onSubmit={() => void handleAssignVehicle()}
        onRefreshResources={() => void loadAssignmentResources(true)}
        directionLabel={directionLabel}
        resourceError={resourceError}
        submitError={assignError}
        isLoadingResources={isLoadingResources}
        isSubmitting={isSubmitting}
      />

      <RequestDetailModal
        open={openRequestDetail}
        onClose={() => setOpenRequestDetail(false)}
        group={selectedGroup}
        canDispatchShuttle={canDispatchShuttle}
        onAssign={() => {
          if (!selectedGroup) {
            return;
          }

          const group = selectedGroup;
          setOpenRequestDetail(false);
          openAssign(group);
        }}
        directionLabel={directionLabel}
      />
    </div>
  );
}
