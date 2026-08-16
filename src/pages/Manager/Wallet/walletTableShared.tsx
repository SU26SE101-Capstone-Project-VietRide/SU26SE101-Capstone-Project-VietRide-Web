export type Translate = (key: string, options?: Record<string, unknown>) => string;


export function EmptyRow({ columns, t }: { columns: number; t: Translate }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-sm text-gray-500">
        {t("wallet.empty")}
      </td>
    </tr>
  );
}
