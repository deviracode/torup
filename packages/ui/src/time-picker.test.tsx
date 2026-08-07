import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimePicker } from "./time-picker.js";

describe("TimePicker", () => {
  it("renders hour and minute selects with current value", () => {
    render(<TimePicker value="09:30" onChange={() => {}} />);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
  });
});
