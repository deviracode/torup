import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control.js";

describe("SegmentedControl", () => {
  it("calls onChange with the clicked option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
        value="open"
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("radio", { name: "Closed" }));
    expect(onChange).toHaveBeenCalledWith("closed");
  });

  it("moves focus and selects the next option with ArrowRight (LTR)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="ltr">
        <SegmentedControl
          options={[
            { value: "open", label: "Open" },
            { value: "active", label: "Active" },
            { value: "closed", label: "Closed" },
          ]}
          value="open"
          onChange={onChange}
        />
      </div>
    );
    screen.getByRole("radio", { name: "Open" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("active");
    expect(screen.getByRole("radio", { name: "Active" })).toHaveFocus();
  });

  it("reverses arrow direction in RTL", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <SegmentedControl
          options={[
            { value: "open", label: "Open" },
            { value: "active", label: "Active" },
            { value: "closed", label: "Closed" },
          ]}
          value="active"
          onChange={onChange}
        />
      </div>
    );
    screen.getByRole("radio", { name: "Active" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("open");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("closed");
  });
});
