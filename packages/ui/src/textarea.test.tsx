import { render, screen } from "@testing-library/react";
import { Textarea } from "./textarea.js";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("passes className through", () => {
    render(<Textarea className="test-class" />);
    expect(screen.getByRole("textbox")).toHaveClass("test-class");
  });

  it("forwards additional props", () => {
    render(<Textarea placeholder="Enter text" rows={5} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Enter text");
    expect(textarea).toHaveAttribute("rows", "5");
  });
});
