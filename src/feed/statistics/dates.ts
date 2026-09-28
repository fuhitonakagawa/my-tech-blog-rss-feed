const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 有効なISO日時だけを受け付ける。 */
export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
};

/** 日本時間の暦日を返す。 */
export const jstDay = (value: Date | string): string => {
  return new Date(new Date(value).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
};

/** 暦日を指定した日数だけ移動する。 */
export const shiftDay = (day: string, days: number): string => {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
};

/** 日本時間の暦日の開始日時をUTCで返す。 */
export const dayStart = (day: string): string => {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - JST_OFFSET_MS).toISOString();
};

/** 存在する暦日かを検証する。 */
export const isDay = (value: unknown): value is string => {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isIsoDate(`${value}T00:00:00.000Z`);
};
