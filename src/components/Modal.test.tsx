import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

describe("Modal", () => {
  it("does not render when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Closed modal">
        Hidden content
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, subtitle, content, and calls onClose", async () => {
    const onClose = vi.fn();

    render(
      <Modal
        open
        onClose={onClose}
        title="Passenger details"
        subtitle="booking@example.com"
      >
        Modal body
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Passenger details")).toBeInTheDocument();
    expect(screen.getByText("booking@example.com")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: /close|đóng/i })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
