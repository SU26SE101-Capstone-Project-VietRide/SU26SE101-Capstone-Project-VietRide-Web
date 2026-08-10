import type { PagedResult } from "./vietride";

export type PageRequest = {
  page: number;
  pageSize: number;
};

type FetchPage<T> = (params: PageRequest) => Promise<PagedResult<T>>;

const DEFAULT_PAGE_SIZE = 100;

export async function fetchAllPages<T>(
  fetchPage: FetchPage<T>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await fetchPage({ page, pageSize });
    items.push(...result.items);

    const reachedLastPage = page >= Math.max(result.totalPages, 1);
    if (
      result.items.length === 0 ||
      (!result.hasNextPage && reachedLastPage)
    ) {
      return items;
    }

    page += 1;
  }
}
