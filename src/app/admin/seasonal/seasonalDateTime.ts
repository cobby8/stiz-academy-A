/** datetime-local 값을 서울 시간으로 해석해 서버에 전달할 ISO 시각으로 바꿉니다. */
export function seoulDateTimeToIso(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    throw new Error("수업 날짜와 시간을 확인해 주세요.");
  }
  const parsed = new Date(`${normalized.length === 16 ? `${normalized}:00` : normalized}+09:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("수업 날짜와 시간을 확인해 주세요.");
  return parsed.toISOString();
}
