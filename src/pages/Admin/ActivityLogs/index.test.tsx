import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminActivityLogs, getAdminUsers, type AdminActivityLog } from "../../../api/vietride";
import ActivityLogs from ".";
import { localDateToUtcExclusiveEnd, localDateToUtcStart } from "./activityLogFilters";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }) }));
vi.mock("../../../api/vietride", () => ({ getAdminActivityLogs: vi.fn(), getAdminUsers: vi.fn() }));

const log = (overrides: Partial<AdminActivityLog> = {}): AdminActivityLog => ({ id: "log-1", actor: { id: "admin-1", displayName: "Nguyễn Quản Trị", email: "admin@vietride.vn", role: "SYSTEM_ADMIN" }, action: "LOCK_USER", metadata: { targetUserId: "user-9" }, ipAddress: "127.0.0.1", userAgent: "Vitest", createdAt: "2026-08-18T10:00:00.000Z", ...overrides });
const page = (items: AdminActivityLog[] = [log()], pageNumber = 1, totalItems = items.length) => ({ items, page: pageNumber, pageSize: 20, totalItems, totalPages: Math.ceil(totalItems / 20), hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber * 20 < totalItems });
const renderPage = (entry = "/admin/activity-logs") => render(<MemoryRouter initialEntries={[entry]}><ActivityLogs /></MemoryRouter>);

describe("Admin ActivityLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminActivityLogs).mockResolvedValue(page());
    vi.mocked(getAdminUsers).mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
  });

  it("calls the API with the default page and page size", async () => {
    renderPage();
    await waitFor(() => expect(getAdminActivityLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    expect((await screen.findAllByText("Nguyễn Quản Trị")).length).toBeGreaterThan(0);
  });

  it("sends an exact actor id, changes filters, and resets page to one", async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminUsers).mockResolvedValue({ items: [{ userId: "admin-2", email: "linh@vietride.vn", displayName: "Linh", role: "SYSTEM_ADMIN", status: "ACTIVE" }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
    renderPage("/admin/activity-logs?page=3&pageSize=20");
    await user.type(screen.getByLabelText("activityLogs.actorFilter"), "Linh");
    await user.click(await screen.findByRole("button", { name: /Linh/ }));
    await waitFor(() => expect(getAdminActivityLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "admin-2", page: 1, pageSize: 20 })));
    await user.click(screen.getByRole("button", { name: "activityLogs.actionFilter" }));
    expect(screen.getByRole("option", { name: "activityLogs.actionGroups.operators" })).toBeDisabled();
    await user.click(screen.getByRole("option", { name: "activityLogs.actions.APPROVE_OPERATOR" }));
    await waitFor(() => expect(getAdminActivityLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "admin-2", action: "APPROVE_OPERATOR", page: 1 })));
  });

  it("converts local dates to UTC and sends the end as the next-day exclusive boundary", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const fromTarget = `${yearMonth}-01`;
    const toTarget = `${yearMonth}-05`;
    renderPage();
    await user.click(screen.getByRole("button", { name: "activityLogs.from" }));
    await user.click(await screen.findByRole("button", { name: fromTarget }));
    await user.click(screen.getByRole("button", { name: "activityLogs.to" }));
    await user.click(await screen.findByRole("button", { name: toTarget }));
    await waitFor(() => expect(getAdminActivityLogs).toHaveBeenLastCalledWith(expect.objectContaining({ from: localDateToUtcStart(fromTarget), to: localDateToUtcExclusiveEnd(toTarget), page: 1 })));
    expect(new Date(localDateToUtcExclusiveEnd(toTarget) as string).getTime() - new Date(localDateToUtcStart(toTarget) as string).getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("renders actor, known and unknown actions, null and unknown metadata", async () => {
    vi.mocked(getAdminActivityLogs).mockResolvedValue(page([log(), log({ id: "log-2", action: "SOME_NEW_ACTION", metadata: null }), log({ id: "log-3", action: "STATION_MERGED", metadata: { sourceStationId: "station-a", sourceStationName: "Bến xe Cũ", targetStationId: "station-b", targetStationName: "Bến xe Mới", customField: "custom-value" } })]));
    renderPage();
    expect((await screen.findAllByText("Khóa tài khoản")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Some new thao tác").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bến xe Cũ.*Bến xe Mới/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: "activityLogs.view" })[1]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("activityLogs.noMetadata")).toBeInTheDocument();
  });

  it("shows loading, empty, and error states with retry", async () => {
    let resolveFirst: ((value: ReturnType<typeof page>) => void) | undefined;
    vi.mocked(getAdminActivityLogs).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    renderPage();
    expect(screen.getByTestId("activity-log-skeleton")).toBeInTheDocument();
    resolveFirst?.(page([]));
    expect(await screen.findByText("activityLogs.empty")).toBeInTheDocument();

    vi.mocked(getAdminActivityLogs).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(page());
    const user = userEvent.setup();
    renderPage("/admin/activity-logs?action=LOCK_USER");
    await user.click(await screen.findByRole("button", { name: "activityLogs.retry" }));
    expect((await screen.findAllByText("Nguyễn Quản Trị")).length).toBeGreaterThan(0);
  });

  it("uses existing pagination and keeps pageSize in the query", async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminActivityLogs).mockResolvedValue(page([log()], 1, 21));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "next" }));
    await waitFor(() => expect(getAdminActivityLogs).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }));
  });

  it("does not let a late response overwrite the newest request", async () => {
    let resolveOld: ((value: ReturnType<typeof page>) => void) | undefined;
    vi.mocked(getAdminActivityLogs).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(page([log({ id: "new-log", actor: { id: "new", displayName: "Newest actor", email: "new@vietride.vn", role: "SYSTEM_ADMIN" }, action: "APPROVE_OPERATOR" })]));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "activityLogs.actionFilter" }));
    await user.click(screen.getByRole("option", { name: "activityLogs.actions.APPROVE_OPERATOR" }));
    expect((await screen.findAllByText("Newest actor")).length).toBeGreaterThan(0);
    resolveOld?.(page([log({ actor: { id: "old", displayName: "Old actor", email: "old@vietride.vn", role: "SYSTEM_ADMIN" } })]));
    await waitFor(() => expect(screen.queryByText("Old actor")).not.toBeInTheDocument());
  });
});






