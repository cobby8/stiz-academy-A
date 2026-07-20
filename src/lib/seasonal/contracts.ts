export type SeasonalApplicationInput = {
  idempotencyKey: string;
  child: {
    name: string;
    birthDate: string;
    gender?: string;
    grade?: string;
    school?: string;
    phone?: string;
  };
  parent: { name: string; phone: string; relation?: string };
  address?: string;
  memo?: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
  items: Array<{
    offeringId: string;
    shuttle?: {
      pickupLocation?: string;
      pickupTime?: string;
      dropoffLocation?: string;
      note?: string;
    };
  }>;
};

export class SeasonalError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}

export function cleanText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function parseApplicationInput(value: unknown): SeasonalApplicationInput {
  const body = value as Partial<SeasonalApplicationInput> | null;
  const key = cleanText(body?.idempotencyKey, 120);
  const childName = cleanText(body?.child?.name, 80);
  const parentName = cleanText(body?.parent?.name, 80);
  const parentPhone = normalizePhone(cleanText(body?.parent?.phone, 30) || "");
  const birthDate = cleanText(body?.child?.birthDate, 30);
  const birth = birthDate ? new Date(birthDate) : null;

  if (!key) throw new SeasonalError("중복 제출 방지 키가 필요합니다.");
  if (!childName || !birth || Number.isNaN(birth.getTime())) throw new SeasonalError("학생 이름과 생년월일을 확인해 주세요.");
  if (!parentName || parentPhone.length < 10 || parentPhone.length > 11) throw new SeasonalError("보호자 이름과 연락처를 확인해 주세요.");
  if (!body?.agreedTerms || !body?.agreedPrivacy) throw new SeasonalError("약관과 개인정보 처리에 동의해 주세요.");
  if (!Array.isArray(body.items) || body.items.length === 0) throw new SeasonalError("특강을 한 개 이상 선택해 주세요.");

  const seen = new Set<string>();
  const items = body.items.map((item) => {
    const offeringId = cleanText(item?.offeringId, 100);
    if (!offeringId || seen.has(offeringId)) throw new SeasonalError("특강 선택 항목이 올바르지 않습니다.");
    seen.add(offeringId);
    return {
      offeringId,
      shuttle: item.shuttle
        ? {
            pickupLocation: cleanText(item.shuttle.pickupLocation, 200),
            pickupTime: cleanText(item.shuttle.pickupTime, 30),
            dropoffLocation: cleanText(item.shuttle.dropoffLocation, 200),
            note: cleanText(item.shuttle.note, 500),
          }
        : undefined,
    };
  });

  return {
    idempotencyKey: key,
    child: {
      name: childName,
      birthDate: birth.toISOString(),
      gender: cleanText(body.child?.gender, 30),
      grade: cleanText(body.child?.grade, 50),
      school: cleanText(body.child?.school, 100),
      phone: cleanText(body.child?.phone, 30),
    },
    parent: { name: parentName, phone: parentPhone, relation: cleanText(body.parent?.relation, 30) },
    address: cleanText(body.address, 300),
    memo: cleanText(body.memo, 1000),
    agreedTerms: true,
    agreedPrivacy: true,
    items,
  };
}

