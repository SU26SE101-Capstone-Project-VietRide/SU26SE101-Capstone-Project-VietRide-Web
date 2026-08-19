import { describe, expect, it } from "vitest";
import { adminMenuConfig, menuLabelKeyFor, operatorAdminMenuConfig } from "../../../components/sidebarMenu";

const paths = (sections: typeof adminMenuConfig) => sections.flatMap((section) => section.items.map((item) => item.path));

describe("Activity Logs access configuration", () => {
  it("exposes the menu only to system admins", () => {
    expect(paths(adminMenuConfig)).toContain("/admin/activity-logs");
    expect(paths(operatorAdminMenuConfig)).not.toContain("/admin/activity-logs");
    expect(menuLabelKeyFor("SYSTEM_ADMIN", "/admin/activity-logs")).toBe("admin.activityLogs");
    expect(menuLabelKeyFor("OPERATOR_ADMIN", "/admin/activity-logs")).toBeNull();
  });
});
