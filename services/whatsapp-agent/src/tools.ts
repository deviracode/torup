import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Tool/function schemas for agent actions.
 * These are passed to the Claude API as available tools.
 */
export const agentTools: Tool[] = [
  {
    name: "cancel_booking",
    description: "Cancel an existing appointment by appointment ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: {
          type: "string",
          description: "The ID of the appointment to cancel.",
        },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "reschedule_booking",
    description:
      "Reschedule an existing appointment to a new time.",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: {
          type: "string",
          description: "The ID of the appointment to reschedule.",
        },
        new_start_time: {
          type: "string",
          description: "The new start time in ISO 8601 format.",
        },
      },
      required: ["appointment_id", "new_start_time"],
    },
  },
  {
    name: "list_appointments",
    description:
      "List upcoming appointments for the current customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_phone: {
          type: "string",
          description: "The customer's phone number.",
        },
      },
      required: ["customer_phone"],
    },
  },
];
