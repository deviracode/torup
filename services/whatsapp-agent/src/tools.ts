import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const agentTools: Tool[] = [
  {
    name: "list_appointments",
    description: "List upcoming appointments for the current customer.",
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
