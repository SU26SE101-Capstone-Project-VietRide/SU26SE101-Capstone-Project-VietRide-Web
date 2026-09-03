import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ParcelClaimEvidence } from "../../../api/vietride";
import ClaimEvidenceCard from "./ClaimEvidenceCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { type?: string; defaultValue?: string }) =>
      options?.type ? `${key}:${options.type}` : options?.defaultValue ?? key,
  }),
}));

const evidence: ParcelClaimEvidence = {
  evidenceId: "evidence-1",
  evidenceType: "INCIDENT_PHOTO",
  reference: "https://storage.example.com/incidents/photo.jpg?token=1",
  note: "Inherited incident photo",
  uploadedByUserId: "passenger-1",
  createdAt: "2026-09-04T09:00:00Z",
};

describe("ClaimEvidenceCard", () => {
  it("previews image evidence and falls back to an open-file action", () => {
    render(<ClaimEvidenceCard evidence={evidence} accepted />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", evidence.reference);
    expect(screen.getByText("claims.evidenceAccepted")).toBeInTheDocument();

    fireEvent.error(image);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /claims.imagePreviewFailed/ }),
    ).toHaveAttribute("href", evidence.reference);
  });

  it("renders documents as links and selects by evidence identity", async () => {
    const onSelectedChange = vi.fn();
    const documentEvidence = {
      ...evidence,
      evidenceId: "invoice-1",
      evidenceType: "INVOICE",
      reference: "https://storage.example.com/invoice.pdf",
    };
    render(
      <ClaimEvidenceCard
        evidence={documentEvidence}
        selected={false}
        onSelectedChange={onSelectedChange}
      />,
    );

    expect(
      screen.getByRole("link", { name: "claims.openDocument" }),
    ).toHaveAttribute("href", documentEvidence.reference);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "claims.acceptThisEvidence" }),
    );
    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });
});
