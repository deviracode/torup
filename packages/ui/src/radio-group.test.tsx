import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";

describe("RadioGroup", () => {
  it("selects a value on click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange}>
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>
    );
    await user.click(screen.getAllByRole("radio")[1]);
    expect(onValueChange).toHaveBeenCalled();
  });
});
