import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state.js";
import { Users } from "lucide-react";

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(<EmptyState icon={Users} title="No staff" description="Add your first team member" action={<button>Add</button>} />);
    expect(screen.getByText("No staff")).toBeInTheDocument();
    expect(screen.getByText("Add your first team member")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
