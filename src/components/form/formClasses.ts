// Class Tailwind chuẩn cho form control — thay cho các bản copy `const inputClass`
// lặp ở từng page. Chỉ những file dùng đúng nguyên văn chuỗi này mới import;
// biến thể khác giữ local cho tới khi màn đó được chuẩn hoá có chủ đích.
export const inputClass =
  "w-full min-h-[50px] rounded-[9999px] border border-[#bfe1ec] bg-white px-4 py-3 text-[17px] font-medium text-slate-700 shadow-[0_0_0_1px_rgba(175,219,234,0.18)] transition focus:border-[#2bb7b0] focus:outline-none focus:ring-4 focus:ring-[#dff7f5]";

export const labelClass = "mb-1 block text-xs font-medium text-gray-600";

// Ô nhập nhiều dòng dùng chung nền/viền với `inputClass` nhưng bo góc chữ nhật:
// bán kính viên thuốc ăn mất chỗ ở hai mép khi nội dung xuống dòng. Thay bằng
// `.replace` để chỉ còn đúng một class `rounded-*`, không phụ thuộc thứ tự
// Tailwind đổ CSS ra như khi ghi đè bằng cách nối thêm class.
export const textareaClass = inputClass.replace(
  "rounded-[9999px]",
  "rounded-xl",
);
