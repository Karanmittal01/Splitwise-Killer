export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  /** Number of minor units, e.g. 2 for cents, 0 for yen. */
  decimals: number;
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", decimals: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thai Baht", decimals: 2 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", decimals: 2 },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", decimals: 2 },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", decimals: 2 },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso", decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", decimals: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  return (
    BY_CODE.get(code.toUpperCase()) ?? {
      code: code.toUpperCase(),
      symbol: code.toUpperCase(),
      name: code.toUpperCase(),
      decimals: 2,
    }
  );
}

export function isSupportedCurrency(code: string): boolean {
  return BY_CODE.has(code.toUpperCase());
}
