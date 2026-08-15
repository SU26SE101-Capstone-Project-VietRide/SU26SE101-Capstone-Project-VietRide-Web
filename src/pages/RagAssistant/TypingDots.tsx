// Ba chấm nảy khi trợ lý đang tra cứu — thay cho dòng chữ "Đang truy xuất..."
// đứng im trong bong bóng, vốn làm màn chat trông như bị treo.
export default function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-vr-600/70"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}
