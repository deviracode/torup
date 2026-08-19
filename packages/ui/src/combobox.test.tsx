import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./combobox.js";

describe("Combobox", () => {
  it("shows placeholder when no selection", () => {
    render(
      <Combobox
        options={[{ value: "a", label: "Alpha" }]}
        value={undefined}
        onChange={() => {}}
        placeholder="Select..."
      />
    );
    // NOTE: the trigger button carries role="combobox" (per the brief's
    // implementation), so it is queried by its combobox role rather than
    // "button" — an explicit role attribute overrides the implicit button role.
    expect(screen.getByRole("combobox", { name: /select\.\.\./i })).toBeInTheDocument();
  });

  it("selects an option and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value={undefined}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("shows the selected label on the trigger", () => {
    render(
      <Combobox
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value="b"
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("combobox", { name: /beta/i })).toBeInTheDocument();
  });

  it("clears the selection when the selected option is re-selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={[{ value: "a", label: "Alpha" }]}
        value="a"
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Alpha" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("filters options by search input", async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value={undefined}
        onChange={() => {}}
        searchPlaceholder="Search..."
      />
    );
    await user.click(screen.getByRole("combobox"));
    // When the popover is open there are two combobox roles (trigger + cmdk
    // input), so target the search input by placeholder.
    await user.type(await screen.findByPlaceholderText("Search..."), "alph");
    expect(screen.queryByRole("option", { name: "Beta" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
  });
});
