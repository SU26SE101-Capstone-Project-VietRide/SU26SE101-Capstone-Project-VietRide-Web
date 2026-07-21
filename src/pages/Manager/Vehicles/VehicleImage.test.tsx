import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VehicleImage } from "./VehicleImage";

const defaultProps = {
  src: "https://example.com/vehicle.jpg",
  alt: "Vehicle 51B-12345",
  width: 96,
  height: 64,
  containerClassName: "h-16 w-24",
  loadingLabel: "Loading image",
  errorLabel: "Image unavailable",
};

describe("VehicleImage", () => {
  it("shows a loader until the image has loaded", () => {
    render(<VehicleImage {...defaultProps} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading image");

    fireEvent.load(screen.getByRole("img", { name: defaultProps.alt }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an accessible fallback when loading fails", () => {
    render(<VehicleImage {...defaultProps} />);

    fireEvent.error(screen.getByRole("img", { name: defaultProps.alt }));

    expect(
      screen.getByRole("img", { name: defaultProps.errorLabel }),
    ).toBeInTheDocument();
  });

  it("returns to the loading state when the source changes", () => {
    const { rerender } = render(<VehicleImage {...defaultProps} />);
    fireEvent.load(screen.getByRole("img", { name: defaultProps.alt }));

    rerender(
      <VehicleImage
        {...defaultProps}
        src="https://example.com/updated-vehicle.jpg"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading image");
  });
});
