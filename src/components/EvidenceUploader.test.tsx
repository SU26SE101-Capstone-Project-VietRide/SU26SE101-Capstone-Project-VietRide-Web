import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FirebaseImageError,
  uploadFirebaseImages,
} from "../utils/firebaseImageUpload";
import EvidenceUploader from "./EvidenceUploader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

vi.mock("../utils/firebaseImageUpload", () => ({
  FirebaseImageError: class FirebaseImageError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  uploadFirebaseImages: vi.fn(),
}));

const uploadMock = vi.mocked(uploadFirebaseImages);
const onChange = vi.fn();

function photo(name = "kien.jpg") {
  return new File(["anh"], name, { type: "image/jpeg" });
}

function renderUploader(value: string[] = [], max?: number) {
  return render(
    <EvidenceUploader
      purpose="PARCEL_PHOTO"
      value={value}
      onChange={onChange}
      label="Ảnh chứng từ"
      max={max}
    />,
  );
}

function pickFiles(files: File[]) {
  fireEvent.change(screen.getByTestId("evidence-file-input"), {
    target: { files },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EvidenceUploader", () => {
  it("đẩy ảnh chọn từ máy lên đúng thư mục rồi trả về URL", async () => {
    uploadMock.mockResolvedValue(["https://cdn.example/a.jpg"]);
    renderUploader();

    pickFiles([photo()]);

    await waitFor(() =>
      expect(uploadMock).toHaveBeenCalledWith("PARCEL_PHOTO", [
        expect.objectContaining({ name: "kien.jpg" }),
      ]),
    );
    expect(onChange).toHaveBeenCalledWith(["https://cdn.example/a.jpg"]);
  });

  it("cộng dồn vào ảnh đã có, không ghi đè", async () => {
    uploadMock.mockResolvedValue(["https://cdn.example/b.jpg"]);
    renderUploader(["https://cdn.example/a.jpg"]);

    pickFiles([photo("them.jpg")]);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        "https://cdn.example/a.jpg",
        "https://cdn.example/b.jpg",
      ]),
    );
  });

  // Chặn trước khi tải để khỏi phí băng thông rồi mới báo lỗi.
  it("không tải lên khi vượt số ảnh cho phép", async () => {
    renderUploader(["https://cdn.example/a.jpg"], 2);

    pickFiles([photo("1.jpg"), photo("2.jpg")]);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "evidenceUpload.tooMany",
      ),
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("dịch lỗi file sai định dạng thành câu đọc được", async () => {
    uploadMock.mockRejectedValue(new FirebaseImageError("INVALID_TYPE"));
    renderUploader();

    pickFiles([photo("tailieu.pdf")]);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "evidenceUpload.invalidType",
      ),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  // Hết quyền upload là lỗi của hệ thống, không phải lỗi người dùng — bảo họ
  // "thử lại" là dẫn sai hướng.
  it("hiện nguyên văn thông báo của server thay vì bảo thử lại", async () => {
    uploadMock.mockRejectedValue(
      new Error("OPERATOR_ADMIN cannot request PARCEL_EVIDENCE_PHOTO upload access."),
    );
    renderUploader();

    pickFiles([photo()]);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "cannot request PARCEL_EVIDENCE_PHOTO upload access",
      ),
    );
  });

  it("xoá được một ảnh đã đính", async () => {
    const user = userEvent.setup();
    renderUploader(["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"]);

    await user.click(
      screen.getByRole("button", { name: "evidenceUpload.remove 1" }),
    );

    expect(onChange).toHaveBeenCalledWith(["https://cdn.example/b.jpg"]);
  });

  it("khoá nút chọn khi đã đủ số ảnh", () => {
    renderUploader(["https://cdn.example/a.jpg"], 1);

    expect(
      screen.getByRole("button", { name: /evidenceUpload.add/ }),
    ).toBeDisabled();
  });
});
