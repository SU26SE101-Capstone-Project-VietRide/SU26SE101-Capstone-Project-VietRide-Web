import { useState } from "react";
import {
  FiBox,
  FiShoppingCart,
  FiCheck,
  FiX,
  FiClock,
  FiTrendingUp,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  packages as mockPackages,
  operatorSubscriptions,
  packagePurchases,
} from "../../../data/mockData";

type Package = any;
type OperatorSubscription = any;
type PackagePurchase = any;

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

// Mocked operator ID - in real app, get from auth context
const CURRENT_OPERATOR_ID = "op1";

export default function ManagerPackages() {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState({
    months: 3,
    voucherCode: "",
    paymentMethod: "wallet" as "wallet" | "qr_code",
  });

  // Get operator's current subscription
  const subscription = operatorSubscriptions.find(
    (s) => s.operatorId === CURRENT_OPERATOR_ID,
  );
  const currentPackage = subscription?.currentPackageId
    ? mockPackages.find((p) => p.id === subscription.currentPackageId)
    : null;

  // Get operator's purchase history
  const purchaseHistory = packagePurchases.filter(
    (p) => p.operatorId === CURRENT_OPERATOR_ID,
  );

  const handlePurchaseClick = (pkg: Package) => {
    setSelectedPackage(pkg);
    setFormData({ months: 3, voucherCode: "", paymentMethod: "wallet" });
    setPurchaseOpen(true);
  };

  const handlePurchase = () => {
    if (!selectedPackage) return;

    const basePrice = selectedPackage.price;
    const totalPrice = (basePrice * formData.months) / selectedPackage.duration;
    let discount = 0;

    // Simple discount logic based on voucher code
    if (formData.voucherCode === "PKG100K") {
      discount = 100000;
    } else if (formData.voucherCode === "SUMMER20") {
      discount = Math.floor(totalPrice * 0.2);
    }

    const finalPrice = totalPrice - discount;

    alert(
      `Mua ${selectedPackage.name} trong ${formData.months} tháng\n` +
        `Giá gốc: ${formatNumber(totalPrice)} VND\n` +
        `Giảm giá: ${formatNumber(discount)} VND\n` +
        `Tổng: ${formatNumber(finalPrice)} VND\n` +
        `Phương thức thanh toán: ${formData.paymentMethod === "wallet" ? "Ví" : "Quét mã QR"}\n\n` +
        `Mua thành công!`,
    );
    setPurchaseOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      {subscription && subscription.status === "active" && currentPackage && (
        <div className="rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 p-6 border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <FiBox className="text-2xl text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Gói đang sử dụng: {currentPackage.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Hết hạn: {subscription.expiryDate} (
                  {subscription.remainingDays} ngày còn lại)
                </p>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Xe đang dùng</p>
                    <p className="font-semibold text-gray-900">
                      {subscription.totalVehiclesUsed}/
                      {currentPackage.maxVehicles}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Tuyến đường</p>
                    <p className="font-semibold text-gray-900">
                      {subscription.totalRoutesUsed}/{currentPackage.maxRoutes}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Thời hạn</p>
                    <p className="font-semibold text-gray-900">
                      {subscription.remainingDays} ngày
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <FiCheck className="text-3xl text-green-600" />
          </div>
        </div>
      )}

      {subscription && subscription.status === "none" && (
        <div className="rounded-lg bg-yellow-50 p-6 border border-yellow-200">
          <p className="text-yellow-900 font-semibold">
            Bạn chưa mua bất kỳ gói dịch vụ nào. Hãy mua một gói bên dưới để bắt
            đầu.
          </p>
        </div>
      )}

      {/* Available Packages */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Các gói dịch vụ có sẵn
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {pkg.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {pkg.description}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg bg-blue-50 p-3">
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(pkg.price)} VND
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  / {pkg.duration} tháng
                </p>
              </div>

              <div className="mb-4 space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <FiBox className="text-sm text-gray-400" />
                  <span className="text-sm text-gray-700">
                    Tối đa {pkg.maxVehicles} xe
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="text-sm text-gray-400" />
                  <span className="text-sm text-gray-700">
                    Tối đa {pkg.maxRoutes} tuyến đường
                  </span>
                </div>
                {pkg.features && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    {pkg.features.slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <FiCheck className="mt-0.5 text-xs text-green-600 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handlePurchaseClick(pkg)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                <FiShoppingCart className="text-lg" />
                Mua gói này
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase History */}
      {purchaseHistory.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Lịch sử mua gói
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Gói
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Thời hạn
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    Giá
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    Giảm giá
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    Tổng tiền
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Thanh toán
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Mã voucher
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    Ngày mua
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchaseHistory.map((purchase) => {
                  const pkg = mockPackages.find(
                    (p) => p.id === purchase.packageId,
                  );
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {pkg?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {purchase.months} tháng
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatNumber(
                          purchase.totalPrice - purchase.discountAmount,
                        )}{" "}
                        VND
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {purchase.discountAmount > 0
                          ? `-${formatNumber(purchase.discountAmount)} VND`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatNumber(purchase.totalPrice)} VND
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {purchase.paymentMethod === "wallet"
                            ? "Ví"
                            : "Quét mã QR"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {purchase.voucherCode || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            purchase.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : purchase.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {purchase.status === "completed"
                            ? "Thành công"
                            : purchase.status === "pending"
                              ? "Đang xử lý"
                              : "Hủy"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {purchase.purchasedAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      <Modal
        isOpen={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        title={`Mua gói: ${selectedPackage?.name || ""}`}
      >
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Thông tin gói:</span>{" "}
              {selectedPackage?.description}
            </p>
            <p className="mt-2 text-sm text-blue-900">
              <span className="font-semibold">Giá gốc:</span>{" "}
              {formatNumber(selectedPackage?.price || 0)} VND /{" "}
              {selectedPackage?.duration} tháng
            </p>
          </div>

          <div>
            <label className={labelClass}>Thời hạn gói (tháng)</label>
            <div className="flex gap-2">
              {[3, 6, 12].map((month) => (
                <button
                  key={month}
                  onClick={() => setFormData({ ...formData, months: month })}
                  className={`flex-1 rounded-lg py-2 font-medium transition-colors ${
                    formData.months === month
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 bg-white text-gray-900 hover:border-blue-300"
                  }`}
                >
                  {month} tháng
                </button>
              ))}
            </div>
            {selectedPackage && (
              <p className="mt-2 text-sm text-gray-600">
                Tổng giá:{" "}
                {formatNumber(
                  (selectedPackage.price * formData.months) /
                    selectedPackage.duration,
                )}{" "}
                VND
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Mã giảm giá (nếu có)</label>
            <input
              type="text"
              placeholder="VD: PKG100K, SUMMER20"
              className={inputClass}
              value={formData.voucherCode}
              onChange={(e) =>
                setFormData({ ...formData, voucherCode: e.target.value })
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              Mã có sẵn: PKG100K (100K), SUMMER20 (20%)
            </p>
          </div>

          <div>
            <label className={labelClass}>Phương thức thanh toán</label>
            <div className="space-y-2">
              <label
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
                style={{
                  backgroundColor:
                    formData.paymentMethod === "wallet" ? "#f0f9ff" : "white",
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  value="wallet"
                  checked={formData.paymentMethod === "wallet"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentMethod: e.target.value as "wallet" | "qr_code",
                    })
                  }
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    Thanh toán bằng ví
                  </p>
                  <p className="text-xs text-gray-600">
                    Sử dụng số dư ví của bạn
                  </p>
                </div>
              </label>

              <label
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
                style={{
                  backgroundColor:
                    formData.paymentMethod === "qr_code" ? "#f0f9ff" : "white",
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  value="qr_code"
                  checked={formData.paymentMethod === "qr_code"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentMethod: e.target.value as "wallet" | "qr_code",
                    })
                  }
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">Quét mã QR</p>
                  <p className="text-xs text-gray-600">
                    Quét mã QR để thanh toán
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setPurchaseOpen(false)}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handlePurchase}
              className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <FiShoppingCart />
              Xác nhận mua
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
