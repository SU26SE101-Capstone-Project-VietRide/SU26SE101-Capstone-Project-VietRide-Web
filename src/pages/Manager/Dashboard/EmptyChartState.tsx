type EmptyChartStateProps = {
  message: string;
};

// Trạng thái rỗng dùng chung cho các khối biểu đồ/danh sách trong Dashboard
export default function EmptyChartState({ message }: EmptyChartStateProps) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}
