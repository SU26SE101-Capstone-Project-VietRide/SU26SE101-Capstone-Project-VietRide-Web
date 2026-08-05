// Thông báo thành công gắn theo từng khu vực thao tác trong màn Routes
type InlineFeedbackProps = { message: string };

export default function InlineFeedback({ message }: InlineFeedbackProps) {
  if (!message) return null;

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}
