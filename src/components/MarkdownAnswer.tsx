import type { ReactNode } from "react";

/**
 * Trợ lý trả lời bằng Markdown (prompt của BE yêu cầu vậy) nhưng bong bóng chat
 * trước đây in thô, nên người dùng thấy nguyên `###`, `**`, `* `. Ở đây parse
 * tay đúng tập cú pháp model hay dùng thay vì kéo thêm dependency markdown:
 *
 * - nội dung tới theo stream nên block có thể chưa đóng (fence hở, danh sách
 *   đang gõ dở) — parser phải chịu được và render phần đã có;
 * - mọi thứ dựng bằng React element, không đụng `dangerouslySetInnerHTML`, nên
 *   câu trả lời từ LLM không thể chèn HTML vào console.
 */

type ListItem = { lines: string[]; child: ListBlock | null };
type ListBlock = { kind: "list"; ordered: boolean; items: ListItem[] };

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "code"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "divider" }
  | { kind: "table"; header: string[]; rows: string[][] }
  | ListBlock;

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const FENCE_RE = /^\s*```/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const DIVIDER_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|?\s*$/;
const TABLE_DIVIDER_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/** Chỉ nhận link an toàn — chặn `javascript:` và mọi scheme lạ model bịa ra. */
const SAFE_HREF_RE = /^(https?:\/\/|mailto:)/i;

const INLINE_SOURCE =
  "`([^`]+)`" + // code
  "|\\*\\*([\\s\\S]+?)\\*\\*" + // **đậm**
  "|__([\\s\\S]+?)__" + // __đậm__
  "|\\*([^*\\n]+)\\*" + // *nghiêng*
  "|(?:(?<![A-Za-z0-9_])_([^_\\n]+)_(?![A-Za-z0-9_]))" + // _nghiêng_
  "|\\[([^\\]]+)\\]\\(([^)\\s]+)\\)"; // [chữ](link)

type ParseResult = { block: Block; next: number };

function isListLine(line: string): boolean {
  return BULLET_RE.test(line) || ORDERED_RE.test(line);
}

function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

/** Dòng mở block khác — dùng để biết khi nào đoạn văn kết thúc. */
function startsNewBlock(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    DIVIDER_RE.test(line) ||
    isListLine(line)
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseCode(lines: string[], start: number): ParseResult {
  const body: string[] = [];
  let index = start + 1;
  // Fence chưa đóng (đang stream) thì lấy hết phần còn lại — vẫn hơn là bỏ trắng.
  while (index < lines.length && !FENCE_RE.test(lines[index])) {
    body.push(lines[index]);
    index += 1;
  }
  return {
    block: { kind: "code", lines: body },
    next: index < lines.length ? index + 1 : index,
  };
}

function parseQuote(lines: string[], start: number): ParseResult {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const match = lines[index].match(QUOTE_RE);
    if (!match) break;
    body.push(match[1]);
    index += 1;
  }
  return { block: { kind: "quote", lines: body }, next: index };
}

function parseTable(lines: string[], start: number): ParseResult {
  const header = splitTableRow(lines[start]);
  const rows: string[][] = [];
  let index = start + 2; // bỏ qua dòng gạch ngăn cách
  while (index < lines.length && TABLE_ROW_RE.test(lines[index])) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }
  return { block: { kind: "table", header, rows }, next: index };
}

function parseParagraph(lines: string[], start: number): ParseResult {
  const body: string[] = [];
  let index = start;
  while (
    index < lines.length &&
    !isBlankLine(lines[index]) &&
    !startsNewBlock(lines[index])
  ) {
    body.push(lines[index].trim());
    index += 1;
  }
  return { block: { kind: "paragraph", lines: body }, next: index };
}

/**
 * Danh sách lồng nhau: mỗi lần gặp dòng thụt sâu hơn thì đệ quy xuống một cấp.
 * Dòng thường nằm ngay dưới một gạch đầu dòng được coi là phần tiếp của mục đó
 * (model hay xuống dòng giữa chừng khi câu dài).
 */
function parseList(lines: string[], start: number, indent: number): ParseResult {
  const bullet = lines[start].match(BULLET_RE);
  const ordered = !bullet;
  const items: ListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlankLine(line)) {
      // Một dòng trống giữa hai gạch đầu dòng vẫn là cùng danh sách.
      if (index + 1 < lines.length && isListLine(lines[index + 1])) {
        index += 1;
        continue;
      }
      break;
    }

    const match = line.match(BULLET_RE) ?? line.match(ORDERED_RE);
    if (!match) {
      if (items.length === 0) break;
      items[items.length - 1].lines.push(line.trim());
      index += 1;
      continue;
    }

    const lineIndent = match[1].length;
    if (lineIndent < indent) break;
    if (lineIndent > indent) {
      if (items.length === 0) break;
      const nested = parseList(lines, index, lineIndent);
      items[items.length - 1].child = nested.block as ListBlock;
      index = nested.next;
      continue;
    }

    const isOrderedLine = !BULLET_RE.test(line);
    if (isOrderedLine !== ordered) break;

    items.push({ lines: [match[match.length - 1]], child: null });
    index += 1;
  }

  return { block: { kind: "list", ordered, items }, next: index };
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBlankLine(line)) {
      index += 1;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const parsed = parseCode(lines, index);
      blocks.push(parsed.block);
      index = parsed.next;
      continue;
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ kind: "divider" });
      index += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const parsed = parseQuote(lines, index);
      blocks.push(parsed.block);
      index = parsed.next;
      continue;
    }

    if (
      TABLE_ROW_RE.test(line) &&
      index + 1 < lines.length &&
      TABLE_DIVIDER_RE.test(lines[index + 1])
    ) {
      const parsed = parseTable(lines, index);
      blocks.push(parsed.block);
      index = parsed.next;
      continue;
    }

    if (isListLine(line)) {
      const match = line.match(BULLET_RE) ?? line.match(ORDERED_RE)!;
      const parsed = parseList(lines, index, match[1].length);
      blocks.push(parsed.block);
      index = parsed.next;
      continue;
    }

    const paragraph = parseParagraph(lines, index);
    blocks.push(paragraph.block);
    index = paragraph.next;
  }

  return blocks;
}

/**
 * Regex tạo mới mỗi lần gọi: hàm này tự đệ quy (đậm lồng link, nghiêng lồng
 * code) mà `lastIndex` của một regex `g` dùng chung sẽ bị vòng trong ghi đè.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = new RegExp(INLINE_SOURCE, "g");
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${match.index}`;
    const [
      whole,
      code,
      boldStars,
      boldUnderscores,
      italicStar,
      italicUnderscore,
      linkText,
      linkHref,
    ] = match;

    if (code !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
        >
          {code}
        </code>,
      );
    } else if (boldStars !== undefined || boldUnderscores !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900">
          {renderInline(boldStars ?? boldUnderscores, key)}
        </strong>,
      );
    } else if (italicStar !== undefined || italicUnderscore !== undefined) {
      nodes.push(
        <em key={key}>{renderInline(italicStar ?? italicUnderscore, key)}</em>,
      );
    } else if (linkText !== undefined && SAFE_HREF_RE.test(linkHref)) {
      nodes.push(
        <a
          key={key}
          href={linkHref}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-vr-900 underline underline-offset-2 hover:text-vr-800"
        >
          {linkText}
        </a>,
      );
    } else {
      nodes.push(whole);
    }

    lastIndex = match.index + whole.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderList(list: ListBlock, keyPrefix: string): ReactNode {
  const itemClass = "marker:text-vr-900 [&>p]:m-0";
  const children = list.items.map((item, position) => {
    const key = `${keyPrefix}-i${position}`;
    return (
      <li key={key} className={itemClass}>
        {renderInline(item.lines.join(" "), key)}
        {item.child && renderList(item.child, key)}
      </li>
    );
  });

  return list.ordered ? (
    <ol
      key={keyPrefix}
      className="list-outside list-decimal space-y-1 pl-5 [&_ol]:mt-1 [&_ul]:mt-1"
    >
      {children}
    </ol>
  ) : (
    <ul
      key={keyPrefix}
      className="list-outside list-disc space-y-1 pl-5 [&_ol]:mt-1 [&_ul]:mt-1"
    >
      {children}
    </ul>
  );
}

function renderBlock(block: Block, position: number): ReactNode {
  const key = `b${position}`;

  switch (block.kind) {
    case "heading": {
      const className =
        block.level <= 2
          ? "text-[15px] font-bold text-slate-900"
          : block.level === 3
            ? "text-sm font-bold text-slate-900"
            : "text-sm font-semibold text-slate-800";
      // Bong bóng chat hẹp nên không dùng h1/h2 thật: giữ ngữ nghĩa tiêu đề phụ
      // và phân cấp bằng cỡ chữ.
      return (
        <p key={key} role="heading" aria-level={Math.min(block.level + 2, 6)} className={className}>
          {renderInline(block.text, key)}
        </p>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="whitespace-pre-line break-words">
          {renderInline(block.lines.join("\n"), key)}
        </p>
      );
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-100"
        >
          <code>{block.lines.join("\n")}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-vr-300 pl-3 text-slate-600 italic"
        >
          {renderInline(block.lines.join("\n"), key)}
        </blockquote>
      );
    case "divider":
      return <hr key={key} className="border-gray-200" />;
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th
                    key={`${key}-h${cellIndex}`}
                    className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold text-slate-800"
                  >
                    {renderInline(cell, `${key}-h${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-r${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${key}-r${rowIndex}c${cellIndex}`}
                      className="border border-gray-200 px-2 py-1 align-top"
                    >
                      {renderInline(cell, `${key}-r${rowIndex}c${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return renderList(block, key);
  }
}

export default function MarkdownAnswer({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-2.5 break-words">
      {blocks.map((block, position) => renderBlock(block, position))}
    </div>
  );
}
