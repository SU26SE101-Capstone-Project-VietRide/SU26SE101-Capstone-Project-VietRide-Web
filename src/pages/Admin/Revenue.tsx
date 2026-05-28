import { FiDollarSign, FiTrendingUp } from "react-icons/fi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const KPI = ({ title, value, change }: { title: string; value: string; change?: string }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className="text-sm text-green-600 font-semibold">{change}</div>
    </div>
  </div>
);

const data = [
  { month: "Jan", pay: 90, commission: 6 },
  { month: "Feb", pay: 110, commission: 8 },
  { month: "Mar", pay: 140, commission: 10 },
  { month: "Apr", pay: 130, commission: 9 },
  { month: "May", pay: 175, commission: 12 },
  { month: "Jun", pay: 200, commission: 15 },
  { month: "Jul", pay: 220, commission: 16 },
  { month: "Aug", pay: 210, commission: 14 },
  { month: "Sep", pay: 250, commission: 18 },
  { month: "Oct", pay: 270, commission: 20 },
  { month: "Nov", pay: 300, commission: 22 },
  { month: "Dec", pay: 340, commission: 25 },
];

const topOperators = [
  { name: "Futa Bus Lines", value: 11.2 },
  { name: "Phương Trang", value: 8.4 },
  { name: "Thành Bưởi", value: 6.1 },
  { name: "Hoàng Long", value: 4.8 },
  { name: "Mai Linh Express", value: 3.2 },
];

export default function Revenue() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Doanh thu nền tảng <span className="ml-3 inline-block rounded-full bg-gray-100 text-xs px-2 py-1 text-gray-600">Admin</span></h1>
        <p className="text-gray-600 mt-1">Tổng quan doanh thu, hoa hồng và phân chia cho các nhà vận hành.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI title="GMV tháng này" value="354 tỷ" change="+13.4%" />
        <KPI title="Hoa hồng nền tảng" value="28.3 tỷ" change="+11.8%" />
        <KPI title="Trả cho nhà xe" value="325.6 tỷ" change="+13.7%" />
        <KPI title="Tăng trưởng YoY" value="+47%" change="+8.2pt" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold mb-4">Doanh thu & hoa hồng theo tháng</h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fill: "#6b7280" }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pay" fill="#2563eb" name="Trả nhà xe (tỷ)" />
              <Bar dataKey="commission" fill="#10b981" name="Hoa hồng (tỷ)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold mb-3">Top nhà vận hành theo doanh thu</h4>
          <div className="space-y-3">
            {topOperators.map((op, idx) => (
              <div key={op.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vr-50 text-vr-600 flex items-center justify-center font-semibold">{idx + 1}</div>
                  <div>
                    <div className="font-semibold">{op.name}</div>
                    <div className="text-xs text-gray-500">{Math.round(op.value * 35)} xe</div>
                  </div>
                </div>
                <div className="w-2/5 text-right">
                  <div className="text-sm font-semibold">{op.value} tỷ</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold mb-3">Chi tiết doanh thu</h4>
          <p className="text-sm text-gray-600">Báo cáo chi tiết theo tuyến và nhà vận hành sẽ hiển thị ở đây.</p>
        </div>
      </div>
    </div>
  );
}
