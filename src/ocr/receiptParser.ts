const AMOUNT_REGEXES = [
  /TOTAL\s*(?:A\s*PAGAR)?[:\s]*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  /([0-9]+\.[0-9]{2})/,
];

const DATE_REGEXES = [
  /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
  /(\d{4}-\d{2}-\d{2})/,
];

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

    const raw = match[1];
    const iso = raw.includes('/')
      ? new Date(raw.split('/').reverse().join('-')).toISOString()
      : new Date(raw).toISOString();

    if (!Number.isNaN(new Date(iso).getTime())) return iso;
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
