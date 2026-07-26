import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiRotateCcw, FiSettings } from "react-icons/fi";
import {
  getRagRuntimeConfig,
  getRagRuntimeConfigHistory,
  rollbackRagRuntimeConfig,
  updateRagRuntimeConfig,
  type RagRuntimeConfig,
  type RagRuntimeConfigHistory,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { formatDateTime } from "../../../utils/date";

type Props = {
  configKey: string | null;
  onClose: () => void;
  onSaved: (config: RagRuntimeConfig) => void;
};

function stringifyValue(value: unknown) {
  return typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2);
}

function parseValue(value: string, valueType?: string): unknown {
  if (valueType === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("Giá trị phải là số.");
    return parsed;
  }
  if (valueType === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error("Giá trị boolean phải là true hoặc false.");
    }
    return value === "true";
  }
  if (valueType === "json") {
    return JSON.parse(value) as unknown;
  }
  return value;
}

export function RagConfigModal({
  configKey,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [config, setConfig] = useState<RagRuntimeConfig | null>(null);
  const [history, setHistory] = useState<RagRuntimeConfigHistory[]>([]);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configKey) return;
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      setLoading(true);
      setError("");
    });
    const request = Promise.all([
      getRagRuntimeConfig(configKey),
      getRagRuntimeConfigHistory(configKey, {
        page: 1,
        pageSize: 20,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
    ]);
    void request
      .then(([detail, historyResult]) => {
        if (ignore) return;
        setConfig(detail);
        setValue(stringifyValue(detail.value));
        setHistory(historyResult.items);
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("ragAudit.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [configKey, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configKey || !config || !reason.trim()) {
      setError(
        t("ragAudit.configReasonRequired", {
          defaultValue: "Lý do thay đổi là bắt buộc.",
        }),
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await updateRagRuntimeConfig(configKey, {
        value: parseValue(value, config.valueType),
        reason: reason.trim(),
      });
      setConfig(updated);
      setValue(stringifyValue(updated.value));
      setReason("");
      onSaved(updated);
      const historyResult = await getRagRuntimeConfigHistory(configKey, {
        page: 1,
        pageSize: 20,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      setHistory(historyResult.items);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("ragAudit.actionFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollback(item: RagRuntimeConfigHistory) {
    if (
      !configKey ||
      !window.confirm(
        t("ragAudit.rollbackConfirm", {
          defaultValue: "Rollback về giá trị của phiên bản này?",
        }),
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await rollbackRagRuntimeConfig(configKey, item.id);
      setConfig(updated);
      setValue(stringifyValue(updated.value));
      onSaved(updated);
    } catch (rollbackError) {
      setError(
        rollbackError instanceof Error
          ? rollbackError.message
          : t("ragAudit.actionFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={configKey !== null}
      onClose={onClose}
      wide
      icon={<FiSettings />}
      title={configKey ?? ""}
      subtitle={t("ragAudit.configDetailHint", {
        defaultValue:
          "Chỉnh giá trị runtime và xem lịch sử thay đổi có audit trail.",
      })}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium"
          >
            {tc("close")}
          </button>
          <button
            type="submit"
            form="rag-config-form"
            disabled={saving || loading}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? tc("processing") : tc("save")}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            id="rag-config-form"
            className="space-y-4"
            onSubmit={(event) => void submit(event)}
          >
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <span>Type: {config?.valueType ?? "-"}</span>
              <span>Risk: {config?.riskLevel ?? "-"}</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Value
              </span>
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="min-h-48 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-vr-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                {t("ragAudit.changeReason", {
                  defaultValue: "Lý do thay đổi",
                })}
              </span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                required
              />
            </label>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
          </form>
          <div>
            <h3 className="font-semibold text-gray-900">
              {t("ragAudit.history", { defaultValue: "Lịch sử thay đổi" })}
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.reason ?? "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void rollback(item)}
                      disabled={saving}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      aria-label="Rollback"
                      title="Rollback"
                    >
                      <FiRotateCcw />
                    </button>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-gray-500">Chưa có lịch sử.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
