export function normalizePumpScannerInput(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";

  const fromUrl = extractFromUrl(value);
  if (fromUrl) return cleanPumpToken(fromUrl);

  const token = extractBestToken(value);
  return cleanPumpToken(token);
}

function extractFromUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const url = new URL(value);

    const queryCandidates = [
      url.searchParams.get("pump"),
      url.searchParams.get("pumpNumber"),
      url.searchParams.get("code"),
      url.searchParams.get("id"),
      url.searchParams.get("p"),
    ].filter(Boolean) as string[];

    if (queryCandidates.length > 0) {
      return queryCandidates[0];
    }

    const lastPathPart = url.pathname.split("/").filter(Boolean).pop();
    return lastPathPart || null;
  } catch {
    return null;
  }
}

function extractBestToken(value: string): string {
  const parts = value
    .split(/[\s\n\r\t,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return value;

  const candidate =
    parts.find((item) => /[a-zA-Z]/.test(item) && /\d/.test(item)) ||
    parts.find((item) => /\d/.test(item)) ||
    parts[0];

  return candidate;
}

function cleanPumpToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^PUMP[#:\-\s]*/i, "")
    .replace(/[^A-Z0-9\-_/]/g, "");
}
