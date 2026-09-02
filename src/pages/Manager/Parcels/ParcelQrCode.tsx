import { QRCodeSVG } from "qrcode.react";

type ParcelQrCodeProps = {
  parcelCode: string;
  title: string;
  description: string;
  ariaLabel: string;
};

/**
 * Mã QR nhận diện kiện hàng. Payload cố ý chỉ là `parcelCode`
 * để máy quét có thể đưa thẳng giá trị vào ô tra cứu/bàn giao.
 */
export default function ParcelQrCode({
  parcelCode,
  title,
  description,
  ariaLabel,
}: ParcelQrCodeProps) {
  return (
    <section className="rounded-xl border border-vr-200 bg-vr-50/60 p-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div
          className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          data-qr-value={parcelCode}
        >
          <QRCodeSVG
            value={parcelCode}
            size={152}
            level="M"
            marginSize={1}
            role="img"
            aria-label={ariaLabel}
          />
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
          <p className="mt-3 break-all rounded-lg border border-vr-200 bg-white px-3 py-2 font-mono text-sm font-bold text-vr-900">
            {parcelCode}
          </p>
        </div>
      </div>
    </section>
  );
}
