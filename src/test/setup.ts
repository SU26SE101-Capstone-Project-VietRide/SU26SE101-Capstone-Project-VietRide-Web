import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import "../i18n";

// findBy*/waitFor mặc định chỉ chờ 1000ms — quá sát khi chạy cả 90 file test song
// song (hook pre-push còn chạy kèm tsc/eslint/build), làm vài màn rớt lúc còn ở
// trạng thái loading dù code đúng. testTimeout trong vitest.config.ts không áp cho
// mốc này nên phải khai riêng.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
