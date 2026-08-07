import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs.js";

describe("Tabs", () => {
  it("renders the animated indicator only inside the active trigger and moves it on switch", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>
    );

    const triggerA = screen.getByRole("tab", { name: "Tab A" });
    const triggerB = screen.getByRole("tab", { name: "Tab B" });

    // The framer-motion indicator span carries a stable class; it is only
    // rendered inside the active trigger.
    expect(triggerA.querySelector(".tabs-active-indicator")).not.toBeNull();
    expect(triggerB.querySelector(".tabs-active-indicator")).toBeNull();

    await user.click(triggerB);

    expect(triggerB).toHaveAttribute("data-state", "active");
    expect(triggerA).toHaveAttribute("data-state", "inactive");
    expect(triggerB.querySelector(".tabs-active-indicator")).not.toBeNull();
    expect(triggerA.querySelector(".tabs-active-indicator")).toBeNull();
  });

  it("supports icons inside triggers", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">
            <svg data-testid="icon-star" aria-hidden="true" />
            Starred
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );
    expect(screen.getByTestId("icon-star")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /starred/i })).toBeInTheDocument();
  });
});
