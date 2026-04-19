/**
 * Detect language from incoming message text.
 * Uses Unicode script detection: Hebrew, Arabic, or defaults to English.
 */
export function detectLanguage(text: string): "he" | "ar" | "en" {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (hebrewChars > arabicChars && hebrewChars > latinChars) return "he";
  if (arabicChars > hebrewChars && arabicChars > latinChars) return "ar";
  if (latinChars > 0) return "en";

  // Default to Hebrew for the Israeli market
  return "he";
}
