## ADDED Requirements

### Requirement: Reminder settings configuration
Business owners SHALL configure appointment reminder intervals via the dashboard settings page. The settings UI SHALL provide a dedicated "Reminders" tab where owners can add, remove, and toggle reminder intervals from preset options (15min, 30min, 1h, 2h, 4h, 12h, 24h, 48h).

#### Scenario: Business owner adds a reminder
- **WHEN** a business owner selects "24 hours before" from the reminder presets and saves
- **THEN** a `reminder_settings` row is created for that business with `minutes_before=1440`

#### Scenario: Business owner removes a reminder
- **WHEN** a business owner deletes the 2-hour reminder from their settings
- **THEN** the corresponding `reminder_settings` row is deleted and no further 2h reminders are sent

#### Scenario: Business owner views reminder settings
- **WHEN** a business owner navigates to Settings → Reminders tab
- **THEN** they see a list of their configured reminder intervals with toggle switches and delete options
