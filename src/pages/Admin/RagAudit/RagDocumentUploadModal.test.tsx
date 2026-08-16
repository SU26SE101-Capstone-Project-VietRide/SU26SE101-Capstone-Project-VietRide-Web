import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadRagDocument } from "../../../api/vietride";
import ToastProvider from "../../../components/toast/ToastProvider";
import { RagDocumentUploadModal } from "./RagDocumentUploadModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  uploadRagDocument: vi.fn(),
}));

function renderModal() {
  return render(
    <ToastProvider>
      <RagDocumentUploadModal open onClose={vi.fn()} onUploaded={vi.fn()} />
    </ToastProvider>,
  );
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["noi dung"], "chinh-sach.md", { type: "text/markdown" });
  await user.upload(
    document.querySelector<HTMLInputElement>("#rag-document-file")!,
    file,
  );
  await user.type(screen.getByLabelText("title"), "Chính sách hủy vé");
}

describe("RagDocumentUploadModal — vai trò được đọc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadRagDocument).mockResolvedValue({
      id: "doc-1",
      title: "Chính sách hủy vé",
      accessLevel: "ADMIN",
      category: "PLATFORM_ADMIN",
      documentType: "GUIDE",
      status: "PENDING_REVIEW",
    });
  });

  // Trước đây là ô nhập tự do: gõ sai "SYSTEM_ADMINN" vẫn lưu thành công nhưng
  // tài liệu vô hình với mọi người vì BE không ràng buộc enum.
  it("hiện đủ 6 vai trò dạng chọn nhiều, không còn ô nhập tay", () => {
    renderModal();

    // Đủ 6 giá trị của RagRole. OPERATOR_STAFF vẫn phải có: console không phục
    // vụ vai trò đó nữa nhưng BE vẫn cấp, và họ vẫn hỏi trợ lý qua client khác.
    for (const role of [
      "roles.PASSENGER",
      "roles.DRIVER",
      "roles.ASSISTANT",
      "roles.OPERATOR_STAFF",
      "roles.OPERATOR_ADMIN",
      "roles.SYSTEM_ADMIN",
    ]) {
      expect(screen.getByLabelText(role)).toBeInTheDocument();
    }
    expect(
      screen.queryByPlaceholderText(/SYSTEM_ADMIN, OPERATOR_ADMIN/),
    ).not.toBeInTheDocument();
  });

  it("gửi mảng vai trò đã tick chứ không phải chuỗi", async () => {
    const user = userEvent.setup();
    renderModal();
    await fillRequired(user);

    await user.click(screen.getByLabelText("roles.OPERATOR_ADMIN"));
    // Nút submit nằm ở footer của Modal, ngoài <form>, liên kết bằng thuộc tính
    // `form=`. jsdom không nối liên kết đó nên phải submit thẳng form.
    fireEvent.submit(document.querySelector("#rag-upload-form")!);

    await waitFor(() =>
      expect(uploadRagDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          audienceRoles: ["SYSTEM_ADMIN", "OPERATOR_ADMIN"],
        }),
      ),
    );
  });

  it("bỏ tick hết thì báo tài liệu sẽ hiện cho tất cả", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByLabelText("roles.SYSTEM_ADMIN"));

    expect(
      screen.getByText("ragAudit.audienceRolesEmpty"),
    ).toBeInTheDocument();
  });
});
