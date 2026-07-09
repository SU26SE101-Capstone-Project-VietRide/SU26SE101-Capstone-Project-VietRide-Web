import type { ReactNode } from "react";

type DetailItemProps = {
  label: string;
  value?: ReactNode;
};

type DetailSectionProps = {
  title: string;
  children: ReactNode;
  columns?: "two" | "three" | "four";
};

const sectionColumns: Record<NonNullable<DetailSectionProps["columns"]>, string> = {
  two: "sm:grid-cols-2",
  three: "sm:grid-cols-2 lg:grid-cols-3",
  four: "sm:grid-cols-2 lg:grid-cols-4",
};

export function DetailItem({ label, value }: DetailItemProps) {
  const displayValue = value === "" || value === null || value === undefined ? "-" : value;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-gray-900">
        {displayValue}
      </div>
    </div>
  );
}

export function DetailSection({
  title,
  children,
  columns = "two",
}: DetailSectionProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      <div className={`grid gap-3 ${sectionColumns[columns]}`}>{children}</div>
    </section>
  );
}
