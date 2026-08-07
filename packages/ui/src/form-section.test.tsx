import { render, screen } from "@testing-library/react";
import { FormSection, SettingRow } from "./form-section.js";
import { Switch } from "./switch.js";

describe("FormSection / SettingRow", () => {
  it("renders section title and description", () => {
    render(<FormSection title="Notifications" description="Choose what to send">content</FormSection>);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Choose what to send")).toBeInTheDocument();
  });
  it("renders a labeled setting row with a control", () => {
    render(
      <SettingRow title="Reminders" description="Send before the appointment">
        <Switch checked />
      </SettingRow>
    );
    expect(screen.getByText("Reminders")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
