export const MAX_PLACE_LABEL_LENGTH = 40;
export const MAX_MESSAGE_LENGTH = 500;

export function normalizeText(value: string, maxLength: number): string | null {
  const trimmed = value.trim();
  const length = Array.from(trimmed).length;

  if (length === 0 || length > maxLength) return null;
  return trimmed;
}
