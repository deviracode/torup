import { render, screen } from "@testing-library/react";
import { Field } from "./field.js";
import { Input } from "./input.js";

describe("Field", () => {
  it("renders label, control, and error", () => {
    render(
      <Field label="Name" htmlFor="name" error="Required">
        <Input id="name" />
      </Field>
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
  it("renders hint when no error", () => {
    render(
      <Field label="Name" htmlFor="name" hint="Shown publicly">
        <Input id="name" />
      </Field>
    );
    expect(screen.getByText("Shown publicly")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
