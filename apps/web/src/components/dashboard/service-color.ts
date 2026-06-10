/**
 * Returns inline style props for an appointment card based on the service's hex color.
 * Falls back to null if no color provided — caller should use STATUS_COLORS fallback.
 */
export function serviceColorStyle(color: string | null | undefined): {
  background: string;
  borderLeftColor: string;
  color: string;
} | null {
  if (!color) return null;
  // Strip # for manipulation
  const hex = color.replace("#", "");
  return {
    background: `${color}2e`,        // ~18% opacity fill
    borderLeftColor: color,           // full opacity left border
    color: `#${hex}cc`,              // ~80% tint for text
  };
}
