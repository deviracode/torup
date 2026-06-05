import Anthropic from "@anthropic-ai/sdk";

export interface BookingIntent {
  service_id: string | null;
  date: string | null;       // YYYY-MM-DD
  time_hour: number | null;  // 0-23
  party_size: number;        // default 1
  confidence: "high" | "low";
}

export async function extractBookingIntent(
  text: string,
  services: Array<{ id: string; name_he: string; name_ar: string | null; name_en: string | null }>,
  language: "he" | "ar" | "en",
  todayDate: string
): Promise<BookingIntent> {
  const client = new Anthropic();

  const serviceRows = services
    .map((s) => `${s.id}|${s.name_he}|${s.name_ar ?? ""}|${s.name_en ?? ""}`)
    .join("\n");

  const todayJs = new Date(todayDate);
  const dayOfWeek = todayJs.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
  const nextDates: Record<string, string> = {};
  for (let d = 1; d <= 7; d++) {
    const dt = new Date(todayDate);
    dt.setUTCDate(dt.getUTCDate() + d);
    const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
    nextDates[name] = dt.toISOString().slice(0, 10);
  }
  const nextMon = nextDates["Mon"];
  const nextTue = nextDates["Tue"];
  const nextWed = nextDates["Wed"];
  const nextThu = nextDates["Thu"];

  const prompt = `Today is ${todayDate} (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek]}). Extract booking intent from this customer message.

Services (format: id|name_he|name_ar|name_en):
${serviceRows}

Customer message: "${text}"

Return ONLY valid JSON with this exact shape:
{
  "service_id": "<id from list above, or null>",
  "date": "<YYYY-MM-DD resolved, or null>",
  "time_hour": <integer 0-23, or null>,
  "party_size": <integer >= 1, default 1>,
  "confidence": "<high or low>"
}

Rules:
- confidence=high: service is matched AND at least date or time is present
- confidence=low: service unmatched, message is greeting-only, or signals are contradictory
- Times: default to afternoon/evening for salon context ("عالخمسه"/"בחמש"/"at five" → 17)
- Numeric dates: "25.7" or "25/7" → "${todayDate.slice(0, 4)}-07-25"
- Relative Hebrew dates: "יום שני הבא"/"שני הקרוב" → ${nextMon}, "יום שלישי הבא" → ${nextTue}, "יום רביעי הבא" → ${nextWed}, "יום חמישי הבא" → ${nextThu}
- Relative Arabic dates: "الاثنين القادم"/"الاثنين الجاي" → ${nextMon}, "الثلاثاء القادم" → ${nextTue}
- "מחר"/"غداً"/"tomorrow" → ${nextDates[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(dayOfWeek + 1) % 7]]}
- party_size: if an explicit number of people is mentioned (e.g. "3 بنات", "שתיים"), use it; otherwise default to 1`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") return fallback();

    const parsed = JSON.parse(block.text.trim());
    return {
      service_id: typeof parsed.service_id === "string" ? parsed.service_id : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      time_hour: typeof parsed.time_hour === "number" ? parsed.time_hour : null,
      party_size:
        typeof parsed.party_size === "number" && parsed.party_size >= 1
          ? Math.floor(parsed.party_size)
          : 1,
      confidence: parsed.confidence === "high" ? "high" : "low",
    };
  } catch {
    return fallback();
  }
}

function fallback(): BookingIntent {
  return { service_id: null, date: null, time_hour: null, party_size: 1, confidence: "low" };
}
