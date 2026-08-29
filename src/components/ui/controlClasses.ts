/*
  Bộ lọc class "skin" cho các control dùng chung (SearchInput, CustomSelect,
  CustomDateTimeInput).

  Vì sao cần: các màn cũ đều truyền nguyên một chuỗi `inputClass` dài vào
  component. Nếu component nối thẳng chuỗi đó vào class của mình thì call site
  giành quyền quyết định border/nền/bo góc/cỡ chữ — và sửa trong component sẽ
  KHÔNG lan ra đâu cả. Lọc bỏ đúng nhóm thuộc tính "ngoại hình" trước khi nối
  giúp component giữ một nguồn sự thật duy nhất, trong khi các class bố cục
  (`w-full`, `sm:w-44`, `lg:col-span-2`…) của call site vẫn còn tác dụng.

  Hệ quả cần nhớ: KHÔNG đổi màu theo trạng thái (lỗi, cảnh báo) bằng cách nối
  `border-red-400` vào `className` — nó sẽ bị lọc mất. Trạng thái nên đi qua
  prop của component (ví dụ `invalid` của `CustomDateTimeInput`).

  Token có tiền tố `!` (`!border-red-400`) đi lọt qua bộ lọc — giống hệt
  `CustomSelect` — nên đó là lối thoát cho trường hợp một lần. Tailwind v4 vẫn
  hiểu cú pháp `!` đứng trước (đã kiểm chứng bằng cách compile thử), nhưng nó
  ghi đè cả `focus:`/`disabled:` của component nên đừng dùng thay cho prop.

  Mỗi component tự khai danh sách pattern của mình vì phần đệm khác nhau:
  SearchInput đệm `pl-11 pr-4` (chừa chỗ cho kính lúp) nên phải chặn `pl`/`pr`,
  còn CustomSelect và CustomDateTimeInput đệm `px-4` nên chặn `px`.
*/

/** Nhóm pattern chung cho mọi control — chỉ khác nhau ở phần padding. */
export const SKIN_CLASS_PATTERNS: RegExp[] = [
  /^rounded(?:-|$)/,
  /^border(?:-|$)/,
  /^bg(?:-|$)/,
  /^text(?:-|$)/,
  /^py(?:-|$)/,
  /^min-h(?:-|$)/,
  /^shadow(?:-|$)/,
  /^outline(?:-|$)/,
  /^ring(?:-|$)/,
];

/** Pattern áp lên nguyên token (giữ cả tiền tố variant) thay vì phần gốc. */
const SKIN_VARIANT_PATTERNS: RegExp[] = [
  /^focus:(?:border|ring|bg|outline)/,
  /^disabled:(?:bg|text|opacity)/,
];

export function stripSkinClasses(input = "", patterns: RegExp[]) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const bare = token.replace(/^focus:/, "");
      return !(
        patterns.some((pattern) => pattern.test(bare)) ||
        SKIN_VARIANT_PATTERNS.some((pattern) => pattern.test(token))
      );
    })
    .join(" ");
}
