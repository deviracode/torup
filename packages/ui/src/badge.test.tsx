import { render, screen } from "@testing-library/react";
import { Badge } from "./badge.js";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Connected</Badge>);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
  it("renders a dot when dot is true", () => {
    render(<Badge dot>Live</Badge>);
    const badge = screen.getByText("Live").closest("span")!;
    const dot = badge.querySelector("span[aria-hidden]");
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain("rounded-full");
  });
});
