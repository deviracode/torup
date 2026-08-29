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
    // Click today's date cell. Matching by bare day number (e.g. "26") is
    // ambiguous whenever an adjacent month's outside-day shares the same
    // number in the visible grid — react-day-picker's gridcell carries the
    // full ISO date in data-day, which is never ambiguous.
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const cell = document.querySelector(`[data-day="${todayIso}"]`)!;
    await user.click(cell.querySelector("button")!);
    expect(onChange).toHaveBeenCalled();
  });
});
