import { render, screen } from "@testing-library/react";
import { Button } from "../button.js";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
