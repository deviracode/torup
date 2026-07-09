import Anthropic from "@anthropic-ai/sdk";
import { agentTools } from "./tools.js";
import { executeTool } from "./tool-executor.js";
import type { ConversationSession } from "./session.js";

const anthropic = new Anthropic();

interface ServiceInfo {
  name_he: string;
  name_ar?: string;
  name_en?: string;
  duration_minutes: number;
  price: number;
}

interface BusinessContext {
  businessId: string;
  businessName: string;
  services: ServiceInfo[];
  language: "he" | "ar" | "en";
  customerPhone?: string;
  botContext?: string | null;
  managerPhone?: string;
}

function buildSystemPrompt(ctx: BusinessContext): string {
  const langInstructions: Record<string, string> = {
    he: "תענה בעברית. היה ידידותי וקצר.",
    ar: "احكي باللهجة الفلسطينية (عامية فلسطينية/شامية). كون ودودة ومختصرة. استخدمي كلمات زي: بدك، هلأ، شو، هاد، كمان، بكرا، يسلمو.",
    en: "Reply in English. Be friendly and concise.",
  };

  const serviceList = ctx.services
    .map((s) => {
      const name = ctx.language === "ar" && s.name_ar ? s.name_ar :
                   ctx.language === "en" && s.name_en ? s.name_en : s.name_he;
      return `- ${name} (${s.duration_minutes} min, ₪${s.price})`;
    })
    .join("\n");

  const businessGuidelines = ctx.botContext?.trim()
    ? `\nBusiness-specific guidelines from the owner (follow these closely — they describe THIS business and override generic assumptions):\n${ctx.botContext.trim()}\n`
    : "";

  const cancelInstruction = ctx.managerPhone
    ? `\n- If the customer mentions cancelling or wants to cancel an appointment — reply with ONLY a short friendly note to message the manager directly: https://wa.me/${ctx.managerPhone} — do NOT call any tool.`
    : "";

  return `You are a friendly assistant for "${ctx.businessName}".
${langInstructions[ctx.language]}

Customer phone number: ${ctx.customerPhone || "unknown"}

Available services:
${serviceList}
${businessGuidelines}

Your job is to help customers:
1. View their existing appointments (use list_appointments tool)
2. Answer general questions about the business

CRITICAL RULES — THESE OVERRIDE EVERYTHING:
- You CANNOT book or schedule appointments. You have ZERO booking capability.
- If the customer mentions ANYTHING related to booking, scheduling, wanting an appointment, or asks about dates/times for a service — your ONLY allowed response is the single word: SHOW_BOOKING_MENU (no other text before or after, no explanation, no "sure", no asking for date or time).
- NEVER ask the customer what date or time they want. NEVER ask which service they want for booking purposes. The booking system handles all of that.
- NEVER confirm, summarize, repeat, or promise a booking time or date back to the customer.
- If the conversation history shows you previously discussed booking — ignore that history and still reply with ONLY: SHOW_BOOKING_MENU
- Use the customer phone number above — do NOT ask for it.
- Keep messages short — this is WhatsApp, not email.${cancelInstruction}`;
}

/**
 * Process a message through the Claude agent and return the response text.
 * Handles multi-turn tool use automatically.
 */
export async function processMessage(
  session: ConversationSession,
  userMessage: string,
  businessContext: BusinessContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(businessContext);

  // Build message history
  const messages: Anthropic.MessageParam[] = [
    ...session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    tools: agentTools,
    messages,
  });

  // Handle tool use loop (agent may call multiple tools)
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, string>,
        businessContext.businessId,
        businessContext.language
      );

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Continue the conversation with tool results
    messages.push({
      role: "assistant",
      content: response.content,
    });
    messages.push({
      role: "user",
      content: toolResults,
    });

    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: agentTools,
      messages,
    });
  }

  // Extract text response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  return textBlocks.map((b) => b.text).join("\n") || "...";
}
