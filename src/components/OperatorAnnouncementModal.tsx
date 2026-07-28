import { useState } from "react";
import { FiSend } from "react-icons/fi";
import {
  sendOperatorNotification,
  type OperatorNotificationScope,
} from "../api/vietride";
import CustomSelect from "./CustomSelect";
import Modal from "./Modal";

type OperatorAnnouncementModalProps = {
  open: boolean;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/20";

export default function OperatorAnnouncementModal({
  open,
  onClose,
}: OperatorAnnouncementModalProps) {
  const [scope, setScope] = useState<OperatorNotificationScope>("OPERATOR");
  const [tripId, setTripId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  function handleClose() {
    if (submitting) return;
    setError("");
    setSuccess("");
    onClose();
  }
  async function handleSubmit() {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedTripId = tripId.trim();

    if (!normalizedTitle || !normalizedBody) {
      setError("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }
    if (scope === "TRIP" && !normalizedTripId) {
      setError("Vui lòng nhập tripId khi gửi theo chuyến.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendOperatorNotification({
        scope,
        tripId: scope === "TRIP" ? normalizedTripId : undefined,
        title: normalizedTitle,
        body: normalizedBody,
      });
      setSuccess(`Đã tiếp nhận thông báo cho ${result.recipientCount} người nhận.`);
      setTitle("");
      setBody("");
      setTripId("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể gửi thông báo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Gửi thông báo vận hành"
      subtitle="Phát thông báo cho toàn nhà xe hoặc người liên quan đến một chuyến."
      icon={<FiSend />}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiSend /> {submitting ? "Đang gửi..." : "Gửi thông báo"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Phạm vi</span>
          <CustomSelect
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as OperatorNotificationScope)
            }
            aria-label="Phạm vi thông báo"
            className={inputClass}
          >
            <option value="OPERATOR">Toàn bộ nhà xe</option>
            <option value="TRIP">Theo chuyến</option>
          </CustomSelect>
        </label>

        {scope === "TRIP" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Trip ID</span>
            <input
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              className={inputClass}
              placeholder="Nhập tripId cần thông báo"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Tiêu đề</span>
          <input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            placeholder="Ví dụ: Thay đổi giờ khởi hành"
          />
          <span className="mt-1 block text-right text-xs text-gray-400">{title.length}/120</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Nội dung</span>
          <textarea
            value={body}
            maxLength={500}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} min-h-28 resize-y`}
            placeholder="Nhập nội dung cần gửi"
          />
          <span className="mt-1 block text-right text-xs text-gray-400">{body.length}/500</span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {success}
          </p>
        )}
      </div>
    </Modal>
  );
}

