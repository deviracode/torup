import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker.js";

describe("DatePicker", () => {
  it("renders placeholder when no value", () => {
    render(<DatePicker value={undefined} onChange={() => {}} placeholder="Pick a date" />);
    expect(screen.getByRole("button", { name: /pick a date/i })).toBeInTheDocument();
  });
  it("selects a date from the calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value={undefined} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    // click today's date cell (the day button inside the gridcell — jsdom
    // hit-testing cannot reach the button through the td)
    const today = new Date().getDate().toString();
    const cell = screen.getByRole("gridcell", { name: today });
    await user.click(cell.querySelector("button")!);
    expect(onChange).toHaveBeenCalled();
  });
});
