// Class Tailwind chuẩn cho form control — thay cho các bản copy `const inputClass`
// lặp ở từng page. Chỉ những file dùng đúng nguyên văn chuỗi này mới import;
// biến thể khác giữ local cho tới khi màn đó được chuẩn hoá có chủ đích.
export const inputClass =
  "w-full min-h-[50px] rounded-[9999px] border border-gray-300 bg-white px-4 py-3 text-[17px] font-medium text-slate-700 shadow-[0_0_0_1px_rgba(15,23,42,0.04)] transition focus:border-[#2bb7b0] focus:outline-none focus:ring-4 focus:ring-[#dff7f5]";

export const labelClass = "mb-1 block text-xs font-medium text-gray-600";

// Ô nhập nhiều dòng dùng chung nền/viền với `inputClass` nhưng bo góc chữ nhật:
// bán kính viên thuốc ăn mất chỗ ở hai mép khi nội dung xuống dòng. Thay bằng
// `.replace` để chỉ còn đúng một class `rounded-*`, không phụ thuộc thứ tự
// Tailwind đổ CSS ra như khi ghi đè bằng cách nối thêm class.
export const textareaClass = inputClass.replace(
  "rounded-[9999px]",
  "rounded-xl",
);

// Ô nhập có icon dẫn ở mép trái. 46px = `px-4` (16) + icon 18 + `gap-3` (12) —
// đúng chỗ chữ bắt đầu trong `CustomSelect` có icon, để một hàng form gồm cả ô
// nhập lẫn ô chọn thẳng một cột chữ. Thay `px-4` chứ không nối thêm `pl-*`, vì
// hai class padding cùng cấp thì thắng thua phụ thuộc thứ tự Tailwind đổ CSS.
export const inputWithIconClass = inputClass.replace(
  "px-4",
  "pl-[46px] pr-4",
);
