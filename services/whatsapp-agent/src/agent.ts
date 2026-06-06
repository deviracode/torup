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

  return `You are a friendly assistant for "${ctx.businessName}".
${langInstructions[ctx.language]}

Customer phone number: ${ctx.customerPhone || "unknown"}

Available services:
${serviceList}

Your job is to help customers:
1. View their existing appointments (use list_appointments tool)
2. Cancel appointments (use cancel_booking tool)
3. Answer general questions about the business

CRITICAL RULES:
- You CANNOT book or schedule appointments. If the customer wants to book, reply with ONLY this exact text (translated to their language): "SHOW_BOOKING_MENU". Nothing else.
- NEVER confirm or promise a booking. You do not have booking capability.
- NEVER reference "buttons" or "menu" — just output SHOW_BOOKING_MENU if they want to book.
- Use the customer phone number above — do NOT ask for it.
- Keep messages short — this is WhatsApp, not email.`;
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
