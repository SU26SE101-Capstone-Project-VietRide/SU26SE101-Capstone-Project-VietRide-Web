import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiEye,
  FiFilter,
  FiInbox,
  FiRefreshCw,
} from "react-icons/fi";
import {
  getAdminOutboxDlq,
  type AdminOutboxDlqItem,
} from "../../api/vietride";
import CustomSelect from "../../components/CustomSelect";
import { DetailItem } from "../../components/DetailLayout";
import Modal from "../../components/Modal";
import { formatDateTime } from "../../utils/date";

type DlqFilters = {
  service: string;
  eventType: string;
  sortDir: "asc" | "desc";
};

const initialFilters: DlqFilters = {
  service: "",
  eventType: "",
  sortDir: "desc",
};

const actionButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-vr-700 transition hover:bg-vr-50";

export default function OutboxDlq() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [draftFilters, setDraftFilters] = useState<DlqFilters>(initialFilters);
  const [filters, setFilters] = useState<DlqFilters>(initialFilters);
  const [items, setItems] = useState<AdminOutboxDlqItem[]>([]);
  const [selected, setSelected] = useState<AdminOutboxDlqItem | null>(null);
  const [unavailableServices, setUnavailableServices] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<
    Array<string | undefined>
  >([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let ignore = false;

    async function loadDlq() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getAdminOutboxDlq({
          cursor,
          pageSize,
          service: filters.service.trim() || undefined,
          eventType: filters.eventType.trim() || undefined,
          sortDir: filters.sortDir,
        });

        if (!ignore) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
          setUnavailableServices(result.unavailableServices);
        }
      } catch (loadError) {
        if (!ignore) {
          setItems([]);
          setNextCursor(null);
          setUnavailableServices([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("outboxDlq.loadFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadDlq();
    return () => {
      ignore = true;
    };
  }, [cursor, filters, reloadKey, t]);

  function resetCursorPagination() {
    setCursor(undefined);
    setCursorHistory([]);
    setPage(1);
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    resetCursorPagination();
    setFilters(draftFilters);
    setReloadKey((value) => value + 1);
  }

  function goToNextPage() {
    if (!nextCursor) {
      return;
    }

    setCursorHistory((current) => [...current, cursor]);
    setCursor(nextCursor);
    setPage((current) => current + 1);
  }

  function goToPreviousPage() {
    const previousCursor = cursorHistory.at(-1);
    setCursorHistory((current) => current.slice(0, -1));
    setCursor(previousCursor);
    setPage((current) => Math.max(1, current - 1));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("outboxDlq.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("outboxDlq.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw />
          {tc("refresh")}
        </button>
      </header>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_auto] xl:items-end"
      >
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {t("outboxDlq.service")}
          </span>
          <input
            value={draftFilters.service}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                service: event.target.value,
              }))
            }
            placeholder="booking"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-vr-500"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {t("outboxDlq.eventType")}
          </span>
          <input
            value={draftFilters.eventType}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                eventType: event.target.value,
              }))
            }
            placeholder="booking.booking_confirmed"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-vr-500"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {t("outboxDlq.sortDirection")}
          </span>
          <CustomSelect
            value={draftFilters.sortDir}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                sortDir: event.target.value === "asc" ? "asc" : "desc",
              }))
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="desc">{t("outboxDlq.newestFirst")}</option>
            <option value="asc">{t("outboxDlq.oldestFirst")}</option>
          </CustomSelect>
        </label>
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600"
        >
          <FiFilter />
          {tc("filter")}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {unavailableServices.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>
            {t("outboxDlq.unavailableServices", {
              services: unavailableServices.join(", "),
            })}
          </span>
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiInbox className="text-vr-700" />
            {t("outboxDlq.queueTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("outboxDlq.readOnlyHint")}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
                <th className="px-5 py-3">{t("outboxDlq.terminalAt")}</th>
                <th className="px-5 py-3">{t("outboxDlq.service")}</th>
                <th className="px-5 py-3">{t("outboxDlq.eventType")}</th>
                <th className="px-5 py-3 text-center">
                  {t("outboxDlq.retryCount")}
                </th>
                <th className="px-5 py-3">{t("outboxDlq.lastError")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.service}-${item.eventId}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                    {formatDateTime(item.terminalAt)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-800">
                      {item.service}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-gray-700">
                    {item.eventType}
                  </td>
                  <td className="px-5 py-4 text-center text-sm font-semibold text-gray-900">
                    {item.retryCount}
                  </td>
                  <td className="max-w-md truncate px-5 py-4 text-sm text-rose-700">
                    {item.lastError || "-"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className={actionButtonClass}
                      title={tc("details")}
                      aria-label={tc("details")}
                    >
                      <FiEye />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {t("outboxDlq.empty")}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {t("outboxDlq.loading")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
          <span className="text-sm text-gray-500">
            {t("outboxDlq.page", { page })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={cursorHistory.length === 0 || isLoading}
              onClick={goToPreviousPage}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {tc("previous")}
            </button>
            <button
              type="button"
              disabled={!nextCursor || isLoading}
              onClick={goToNextPage}
              className="cursor-pointer rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              {tc("next")}
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        wide
        icon={<FiAlertTriangle size={20} />}
        title={t("outboxDlq.detailTitle")}
        subtitle={selected?.eventType}
        footer={
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label={t("outboxDlq.eventId")}
                value={selected.eventId}
              />
              <DetailItem
                label={t("outboxDlq.service")}
                value={selected.service}
              />
              <DetailItem
                label={t("outboxDlq.retryCount")}
                value={selected.retryCount}
              />
              <DetailItem
                label={t("outboxDlq.createdAt")}
                value={formatDateTime(selected.createdAt)}
              />
              <DetailItem
                label={t("outboxDlq.terminalAt")}
                value={formatDateTime(selected.terminalAt)}
              />
              <DetailItem
                label={t("outboxDlq.lastError")}
                value={selected.lastError || "-"}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                {t("outboxDlq.payload")}
              </p>
              <pre className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(selected.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
