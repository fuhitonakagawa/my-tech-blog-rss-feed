const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 英語の月名または3文字略称で示された掲載日をUTCの午前0時として返す */
export const parseEnglishPublicationDate = (value: string): string => {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) {
    throw new Error('公開日の形式が不正です');
  }
  const month = MONTHS.findIndex((name) => name === match[1] || name.slice(0, 3) === match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error('公開日が存在しません');
  }
  return date.toISOString();
};
