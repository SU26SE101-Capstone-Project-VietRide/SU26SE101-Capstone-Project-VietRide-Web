import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const SAMPLE = [
  { month: "Jan", a: 100 },
  { month: "Feb", a: 110 },
  { month: "Mar", a: 130 },
  { month: "Apr", a: 120 },
  { month: "May", a: 150 },
  { month: "Jun", a: 170 },
  { month: "Jul", a: 180 },
  { month: "Aug", a: 175 },
  { month: "Sep", a: 200 },
  { month: "Oct", a: 220 },
  { month: "Nov", a: 240 },
  { month: "Dec", a: 270 },
];

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Báo cáo hệ thống</h1>
        <p className="text-gray-600 mt-1">Xuất báo cáo, lọc theo ngày và nhà xe.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Tổng chuyến kiểm soát</p>
          <p className="text-2xl font-bold text-gray-900">1,566</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">GMV (tháng)</p>
          <p className="text-2xl font-bold text-gray-900">354 tỷ</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Hoa hồng nền tảng</p>
          <p className="text-2xl font-bold text-gray-900">651.7 tỷ</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold mb-4">Doanh thu theo tháng</h3>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={SAMPLE}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="a" stroke="#6366f1" fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
