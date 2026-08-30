// Logic chọn ghế cho khách mất ghế cũ khi thay xe (handoff "FE đồng bộ ghế sau
// khi thay xe").
//
// Tách khỏi component vì đây là phần dễ sai nhất của luồng và cần test riêng:
// hai khách không được trùng ghế, ghế BE đã giữ cho người khác không được đem
// đi chọn lại, và khi preview đổi (đổi xe, preview lại sau lỗi) thì lựa chọn cũ
// phải bị loại bỏ chứ không trôi theo.
//
// Luật gốc nằm ở BE (`VehicleSubstitutionSeatAssignmentPolicy`): FE chỉ chặn
// trước để khỏi bắn một request chắc chắn bị từ chối — nơi quyết định cuối vẫn
// là `409 REPLACEMENT_SEAT_NOT_AVAILABLE` / `REPLACEMENT_SEAT_ASSIGNMENT_REQUIRED`.
import type {
  SubstituteVehiclePreviewResult,
  SubstituteVehicleSeatAssignment,
  SubstituteVehicleSeatPreview,
} from "../api/vietride";

/** `passengerId` → số ghế Admin đang chọn. */
export type SeatSelectionMap = Record<string, string>;

/** Khách BE không giữ được ghế cũ — đúng nhóm phải hiện bộ chọn. */
export function passengersNeedingSeat(
  preview: SubstituteVehiclePreviewResult | null,
): SubstituteVehicleSeatPreview[] {
  return (preview?.passengers ?? []).filter(
    (passenger) => passenger.requiresAdminSelection,
  );
}

/**
 * Ghế đã bị chiếm dưới góc nhìn của MỘT khách: ghế BE giữ sẵn cho người khác,
 * cộng với ghế Admin đã chọn cho người khác. Ghế của chính khách đó không tính
 * là bị chiếm, nếu không thì lựa chọn hiện tại tự biến mất khỏi danh sách.
 */
export function takenSeatsExcept(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
  passengerId: string,
): Set<string> {
  const taken = new Set<string>();

  for (const passenger of preview?.passengers ?? []) {
    if (passenger.passengerId === passengerId) continue;
    if (passenger.proposedSeatNumber) taken.add(passenger.proposedSeatNumber);
  }

  for (const [id, seat] of Object.entries(selections)) {
    if (id === passengerId || !seat) continue;
    taken.add(seat);
  }

  return taken;
}

/**
 * Ghế còn chọn được cho một khách.
 *
 * Nguồn là `alternativeSeatNumbers` của CHÍNH khách đó — không phải
 * `availableSeatNumbers` của cả xe: danh sách toàn xe còn gồm cả ghế BE đã giữ
 * cho khách khác.
 */
export function seatOptionsFor(
  preview: SubstituteVehiclePreviewResult | null,
  passenger: SubstituteVehicleSeatPreview,
  selections: SeatSelectionMap,
): string[] {
  const taken = takenSeatsExcept(preview, selections, passenger.passengerId);
  return passenger.alternativeSeatNumbers.filter((seat) => !taken.has(seat));
}

/** Khách còn thiếu ghế — dùng để chặn submit và để nói còn thiếu mấy người. */
export function missingSeatSelections(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
): SubstituteVehicleSeatPreview[] {
  return passengersNeedingSeat(preview).filter(
    (passenger) => !selections[passenger.passengerId]?.trim(),
  );
}

export function isSeatSelectionComplete(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
): boolean {
  return missingSeatSelections(preview, selections).length === 0;
}

/**
 * Ghế bị hai khách cùng chọn. Bộ chọn đã loại ghế của người khác nên trên lý
 * thuyết không xảy ra, nhưng preview có thể được nạp lại giữa chừng — kiểm lại
 * trước khi gửi rẻ hơn nhiều so với một `409` giữa lúc xe đang hỏng.
 */
export function duplicateSeatSelections(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const passenger of preview?.passengers ?? []) {
    const seat = passenger.requiresAdminSelection
      ? selections[passenger.passengerId]?.trim()
      : passenger.proposedSeatNumber?.trim();
    if (!seat) continue;
    if (seen.has(seat)) duplicates.add(seat);
    seen.add(seat);
  }

  return [...duplicates];
}

/**
 * Body `seatAssignments` gửi lên BE.
 *
 * CHỈ gồm khách `requiresAdminSelection` — khách giữ được ghế cũ đã được BE tự
 * gán từ preview, gửi thêm chỉ làm body sai với hợp đồng. Giữ được toàn bộ ghế
 * thì trả mảng rỗng và caller bỏ hẳn field khỏi body.
 */
export function buildSeatAssignments(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
): SubstituteVehicleSeatAssignment[] {
  return passengersNeedingSeat(preview).flatMap((passenger) => {
    const seat = selections[passenger.passengerId]?.trim();
    return seat
      ? [{ passengerId: passenger.passengerId, newSeatNumber: seat }]
      : [];
  });
}

/**
 * Giữ lại đúng những lựa chọn còn hợp lệ sau khi preview đổi.
 *
 * Preview mới có thể thuộc xe khác, thiếu khách cũ hoặc không còn ghế đó. Bê
 * nguyên map cũ sang là gửi lên `passengerId` lạ (`409
 * REPLACEMENT_SEAT_NOT_AVAILABLE`) hoặc hiện cho người vận hành một ghế mà xe
 * mới không có.
 */
export function pruneSeatSelections(
  preview: SubstituteVehiclePreviewResult | null,
  selections: SeatSelectionMap,
): SeatSelectionMap {
  const next: SeatSelectionMap = {};

  for (const passenger of passengersNeedingSeat(preview)) {
    const seat = selections[passenger.passengerId]?.trim();
    if (!seat) continue;
    if (!passenger.alternativeSeatNumbers.includes(seat)) continue;
    // Ghế đã bị người khác giữ trong lượt prune này thì bỏ luôn, tránh dựng ra
    // một map tự mâu thuẫn.
    if (Object.values(next).includes(seat)) continue;
    next[passenger.passengerId] = seat;
  }

  return next;
}

/** Số khách giữ nguyên được ghế cũ — con số trấn an ở đầu bảng đối chiếu. */
export function keptSeatCount(
  preview: SubstituteVehiclePreviewResult | null,
): number {
  return (preview?.passengers ?? []).filter(
    (passenger) =>
      !passenger.requiresAdminSelection &&
      Boolean(passenger.proposedSeatNumber),
  ).length;
}
