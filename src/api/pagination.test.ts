import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./pagination";

describe("fetchAllPages", () => {
  it("loads every server page with the configured batch size", async () => {
    const fetchPage = vi.fn(async ({ page, pageSize }) => ({
      items: page === 1 ? ["first", "second"] : ["third"],
      page,
      pageSize,
      totalItems: 3,
      totalPages: 2,
      hasPreviousPage: page > 1,
      hasNextPage: page < 2,
    }));

    await expect(fetchAllPages(fetchPage, 2)).resolves.toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 2 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 2 });
  });

  it("stops defensively when a next page is empty", async () => {
    const fetchPage = vi.fn(async ({ page, pageSize }) => ({
      items: page === 1 ? ["first"] : [],
      page,
      pageSize,
      totalItems: 2,
      totalPages: 3,
      hasPreviousPage: page > 1,
      hasNextPage: true,
    }));

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(["first"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
