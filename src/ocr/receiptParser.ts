const AMOUNT_REGEXES = [
  /TOTAL\s*(?:A\s*PAGAR)?[:\s]*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  /([0-9]+\.[0-9]{2})/,
];

const DATE_REGEXES = [
  /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
  /(\d{4}-\d{2}-\d{2})/,
];

function parseReceiptDateKey(value: string): string | null {
  const trimmed = value.trim();

  const brMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (brMatch) {
    const year = Number(brMatch[3]);
    const month = Number(brMatch[2]) - 1;
    const day = Number(brMatch[1]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month
      && localDate.getDate() === day
    ) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

export interface ParsedReceipt {
  amount: number | null;
  date: string | null;
  merchant: string | null;
  rawText: string;
}

export function detectAmount(text: string): number | null {
  for (const regex of AMOUNT_REGEXES) {
    const match = text.match(regex);
    if (!match) continue;

    const candidate = match[1]
      .replace(/\./g, '')
      .replace(',', '.');

    const value = parseFloat(candidate);
    if (!Number.isNaN(value) && value > 0) return value;
  }
  return null;
}

export function detectDate(text: string): string | null {
  for (const regex of DATE_REGEXES) {
    const match = text.match(regex);
    if (!match) continue;

    const parsed = parseReceiptDateKey(match[1]);
    if (parsed) return parsed;
  }
  return null;
}

export function detectMerchant(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const merchant = lines.find((line) => !/^\d|^R\$|^CNPJ|^CPF|^Data|^Valor/i.test(line));
  return merchant ?? null;
}

export function parseReceiptText(text: string): ParsedReceipt {
  return {
    amount: detectAmount(text),
    date: detectDate(text),
    merchant: detectMerchant(text),
    rawText: text,
  };
}
