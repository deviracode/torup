import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch.js";

describe("Switch", () => {
  it("renders a switch role and reflects checked state", () => {
    render(<Switch checked />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });
  it("calls onCheckedChange on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
