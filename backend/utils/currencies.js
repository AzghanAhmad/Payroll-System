export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'PKR', symbol: 'Rs' },
  { code: 'WST', symbol: 'ST$' },
  { code: 'FJD', symbol: 'FJ$' },
  { code: 'PGK', symbol: 'K' },
  { code: 'TOP', symbol: 'T$' },
  { code: 'SBD', symbol: 'SI$' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'HKD', symbol: 'HK$' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'CHF', symbol: 'CHF' },
];

export const getCurrencySymbol = (code) =>
  CURRENCIES.find((c) => c.code === code)?.symbol || code || '$';
