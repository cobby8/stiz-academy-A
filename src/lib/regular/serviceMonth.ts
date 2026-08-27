/** 서버 위치와 무관하게 STIZ 운영 기준(Asia/Seoul)의 YYYY-MM을 만든다. */
export function koreaServiceMonth(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value);
  const part = (type: "year" | "month") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}`;
}

export function isServiceMonth(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
