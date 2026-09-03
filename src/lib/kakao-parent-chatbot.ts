import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  classifyParentUtterance,
  type ParentRequestKind,
} from "@/lib/kakao-chatbot-contract";

export { classifyParentUtterance, getKakaoUserKey } from "@/lib/kakao-chatbot-contract";
export type { KakaoSkillPayload, ParentRequestKind } from "@/lib/kakao-chatbot-contract";

const LINK_TTL_MS = 15 * 60_000;
const CONFIRM_WORDS = /^(접수|접수할게요|확인|네|예|맞아요|진행)$/;
const CANCEL_WORDS = /^(취소|아니요|다시|접수 취소)$/;

const DIRECT_REQUEST_LINKS: Record<string, { label: string; path: string; description: string }> = {
  "정규수업 결석": { label: "결석 날짜 선택하기", path: "/mypage/regular-absence", description: "다가오는 실제 수업일과 반을 선택하면 결석과 해당일 셔틀 제외가 함께 접수돼요." },
  "방학특강 결석": { label: "특강 결석 접수하기", path: "/mypage/seasonal", description: "신청한 특강 회차를 선택해 결석을 알려주세요." },
  "보강 예약": { label: "보강 예약하기", path: "/mypage/makeup", description: "사용 가능한 보강권과 정원이 맞는 수업을 확인해 예약할 수 있어요." },
  "오늘 셔틀 안 타요": { label: "오늘 셔틀 변경하기", path: "/mypage/shuttle", description: "수업은 참석하고 셔틀만 이용하지 않는 경우에 선택해주세요. 기사님 운행 화면에 바로 표시돼요." },
  "오늘 다른 곳에서 타요": { label: "탑승 장소 변경하기", path: "/mypage/shuttle", description: "날짜·등하원 방향·오늘 탈 장소를 확인해 기사님 운행 화면에 바로 전달해요." },
  "입금했어요": { label: "입금 알리기", path: "/mypage/payments", description: "해당 청구서와 입금일을 선택하면 원장님 확인함에 접수돼요." },
  "영수증 요청": { label: "영수증 요청하기", path: "/mypage/payments", description: "납부 완료된 청구서를 선택해 영수증을 요청할 수 있어요." },
};

const DIRECT_KIND_LINKS: Partial<Record<ParentRequestKind, { label: string; path: string; description: string }>> = {
  REGULAR_ABSENCE: DIRECT_REQUEST_LINKS["정규수업 결석"],
  SEASONAL_ABSENCE: DIRECT_REQUEST_LINKS["방학특강 결석"],
  MAKEUP: DIRECT_REQUEST_LINKS["보강 예약"],
  SHUTTLE_SKIP: DIRECT_REQUEST_LINKS["오늘 셔틀 안 타요"],
  SHUTTLE_LOCATION: DIRECT_REQUEST_LINKS["오늘 다른 곳에서 타요"],
  PAYMENT_CONFIRM: DIRECT_REQUEST_LINKS["입금했어요"],
  RECEIPT: DIRECT_REQUEST_LINKS["영수증 요청"],
  CLASS_CHANGE: { label: "수강 변경 신청하기", path: "/mypage/enrollment-change", description: "현재 등록 반과 실제 개설 반을 확인해 변경을 신청할 수 있어요. 원장님 승인 후 반영됩니다." },
  PAUSE: { label: "휴원 신청하기", path: "/mypage/enrollment-change", description: "현재 수강 정보를 확인해 휴원을 신청할 수 있어요. 원장님 승인 후 반영됩니다." },
  WITHDRAW: { label: "퇴원 신청하기", path: "/mypage/enrollment-change", description: "현재 수강 정보를 확인해 퇴원을 신청할 수 있어요. 원장님 승인 후 반영됩니다." },
};

function siteUrl(path: string): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.stiz-dasan.kr").replace(/\/+$/, "");
  return `${origin}${path}`;
}

type IdentityRow = { id: string; parentUserId: string | null; status: string };
type ChildRow = { id: string; name: string; grade: string | null };
type IntakeRow = { id: string; kind: ParentRequestKind; sourceText: string; studentId: string | null; status: string };

function secret(): string {
  const value = process.env.KAKAO_CHATBOT_IDENTITY_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("KAKAO_CHATBOT_IDENTITY_SECRET_MISSING");
  return value;
}

function digest(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function tokenDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function verifySkillSecret(received: string | null): boolean {
  const expected = process.env.KAKAO_CHATBOT_SKILL_SECRET?.trim();
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

const KIND_LABEL: Record<ParentRequestKind, string> = {
  REGULAR_ABSENCE: "정규수업 결석", SEASONAL_ABSENCE: "방학특강 결석", MAKEUP: "보강 예약", EARLY_LEAVE: "조퇴 상담",
  SHUTTLE_SKIP: "당일 셔틀 미탑승", SHUTTLE_LOCATION: "당일 다른 장소 탑승", SHUTTLE_START_STOP: "정규 셔틀 신청·중단",
  SHUTTLE_CHANGE: "셔틀 장소·시간 변경", SHUTTLE_FEE: "셔틀비 문의·면제", PAYMENT_CONFIRM: "입금 확인", BILLING_CORRECTION: "청구 금액 확인",
  RECEIPT: "영수증 요청", REFUND: "환불·결제 취소", CLASS_CHANGE: "반·요일·시간 변경", CLASS_ADD: "수업 추가", PAUSE: "휴원",
  RESUME: "복귀", WITHDRAW: "퇴원", CONTACT_CHANGE: "연락처 변경", CONSULTATION: "기타 상담", HUMAN: "상담원 연결", UNKNOWN: "내용 확인 필요",
};

export function kakaoText(text: string, quickReplies: string[] = [], webLink?: { label: string; url: string }) {
  const buttons = webLink ? [{ action: "webLink", label: webLink.label, webLinkUrl: webLink.url }] : undefined;
  return {
    version: "2.0",
    template: {
      outputs: buttons
        ? [{ basicCard: { description: text, buttons } }]
        : [{ simpleText: { text } }],
      quickReplies: quickReplies.map((label) => ({ action: "message", label, messageText: label })),
    },
  };
}

export async function resolveIdentity(botId: string, userKey: string): Promise<IdentityRow | null> {
  const rows = await prisma.$queryRawUnsafe<IdentityRow[]>(
    `UPDATE "KakaoParentIdentity" SET "lastSeenAt"=now(),"updatedAt"=now()
      WHERE "botId"=$1 AND "userKeyHash"=$2
      RETURNING id,"parentUserId",status`, botId, digest(userKey),
  );
  return rows[0] ?? null;
}

export async function issueLink(botId: string, userKey: string, siteOrigin: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  const rows = await prisma.$queryRawUnsafe<IdentityRow[]>(
    `INSERT INTO "KakaoParentIdentity"
       ("botId","userKeyHash","linkTokenHash","linkExpiresAt","lastSeenAt","updatedAt")
     VALUES ($1,$2,$3,$4,now(),now())
     ON CONFLICT ("botId","userKeyHash") DO UPDATE SET
       "linkTokenHash"=EXCLUDED."linkTokenHash", "linkExpiresAt"=EXCLUDED."linkExpiresAt",
       "lastSeenAt"=now(), "updatedAt"=now()
     RETURNING id,"parentUserId",status`,
    botId, digest(userKey), tokenDigest(token), expiresAt,
  );
  return { identity: rows[0], url: new URL(`/mypage/kakao-connect?token=${encodeURIComponent(token)}`, siteOrigin).toString() };
}

export async function bindIdentity(token: string, parentUserId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "KakaoParentIdentity" SET
       "parentUserId"=$2,status='ACTIVE',"linkedAt"=now(),"linkTokenHash"=NULL,"linkExpiresAt"=NULL,"updatedAt"=now()
     WHERE "linkTokenHash"=$1 AND "linkExpiresAt">now() AND status<>'REVOKED'
     RETURNING id`, tokenDigest(token), parentUserId,
  );
  if (!rows[0]) throw new Error("INVALID_OR_EXPIRED_LINK");
  return rows[0];
}

async function childrenOf(parentUserId: string): Promise<ChildRow[]> {
  return prisma.$queryRawUnsafe<ChildRow[]>(
    `SELECT id,name,grade FROM "Student"
      WHERE "parentId"=$1 AND "mergedIntoStudentId" IS NULL ORDER BY name`, parentUserId,
  );
}

/** 보호자 실명·전화번호 없이, 인증 계정에 실제 연결된 자녀 이름만으로 부르는 이름을 만든다. */
export function formatKakaoParentDisplayName(children: Array<Pick<ChildRow, "name">>): string {
  const names = [...new Set(children.map((child) => child.name.replace(/\s+/g, " ").trim()).filter(Boolean))];
  if (names.length === 0) return "학부모님";
  if (names.length === 1) return `${names[0]} 학생 학부모님`;
  return `${names.join("·")} 학생 보호자`;
}

function selectChild(children: ChildRow[], text: string): ChildRow | null {
  if (children.length === 1) return children[0];
  const matches = children.filter((child) => text.includes(child.name));
  return matches.length === 1 ? matches[0] : null;
}

async function latestDraft(identityId: string): Promise<IntakeRow | null> {
  const rows = await prisma.$queryRawUnsafe<IntakeRow[]>(
    `SELECT id,kind,"sourceText","studentId",status FROM "KakaoParentIntake"
      WHERE "identityId"=$1 AND status IN ('DRAFT','NEEDS_DETAILS')
        AND "createdAt">now()-interval '30 minutes'
      ORDER BY "createdAt" DESC LIMIT 1`, identityId,
  );
  return rows[0] ?? null;
}

function draftResponse(draft: IntakeRow, studentName?: string | null) {
  if (draft.status === "SUBMITTED") return kakaoText("이미 접수된 요청이에요.");
  if (!draft.studentId || !studentName) return null;
  return kakaoText(
    `${studentName} 학생의 ‘${KIND_LABEL[draft.kind]}’ 요청으로 이해했어요.\n\n“${draft.sourceText}”\n\n이 내용으로 접수할까요?`,
    ["접수할게요", "다시 말할게요", "취소"],
  );
}

export async function handleLinkedMessage(identity: IdentityRow, utterance: string, providerRequestId?: string | null) {
  const text = utterance.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!identity.parentUserId) throw new Error("IDENTITY_NOT_LINKED");
  const children = await childrenOf(identity.parentUserId);
  if (children.length === 0) return kakaoText("연결된 수강생을 찾지 못했어요. 학원으로 문의해 주세요.", ["상담원 연결"]);
  const parentDisplayName = formatKakaoParentDisplayName(children);

  const draft = await latestDraft(identity.id);
  if (draft && (CANCEL_WORDS.test(text) || text === "다시 말할게요")) {
    await prisma.$executeRawUnsafe(`UPDATE "KakaoParentIntake" SET status='CANCELED',"updatedAt"=now() WHERE id=$1 AND status IN ('DRAFT','NEEDS_DETAILS')`, draft.id);
    return kakaoText("작성 중인 요청을 취소했어요. 새로 말씀해 주세요.", ["결석·보강", "셔틀", "청구·영수증", "수강 변경", "정보·상담"]);
  }
  if (draft && CONFIRM_WORDS.test(text)) {
    if (!draft.studentId) {
      return kakaoText("접수 전에 자녀를 먼저 선택해 주세요.", children.slice(0, 10).map((item) => item.name));
    }
    const changed = Number(await prisma.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake" SET status='SUBMITTED',"confirmedAt"=now(),"updatedAt"=now()
        WHERE id=$1 AND "studentId" IS NOT NULL AND status IN ('DRAFT','NEEDS_DETAILS')`, draft.id,
    ));
    if (changed === 0) return kakaoText("이미 접수된 요청이에요.");
    return kakaoText(`${KIND_LABEL[draft.kind]} 요청을 접수했어요. 원장님이 확인한 뒤 필요한 경우 카카오톡이나 전화로 연락드릴게요.`);
  }
  if (!draft && CONFIRM_WORDS.test(text)) {
    return kakaoText("이미 접수됐거나 현재 확인할 요청이 없어요. 새 요청은 내용을 문장으로 말씀해 주세요.", ["결석·보강", "셔틀", "청구·영수증", "수강 변경", "정보·상담"]);
  }

  if (draft && !draft.studentId) {
    const selected = selectChild(children, text);
    if (!selected) return kakaoText("자녀 이름을 한 번만 더 선택해 주세요.", children.slice(0, 10).map((item) => item.name));
    await prisma.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake" SET "studentId"=$2,status='DRAFT',
        "structuredJson"=$3::jsonb,"updatedAt"=now() WHERE id=$1 AND status IN ('DRAFT','NEEDS_DETAILS')`,
      draft.id, selected.id, JSON.stringify({ studentId: selected.id, studentName: selected.name, kind: draft.kind }),
    );
    return kakaoText(
      `${selected.name} 학생의 ‘${KIND_LABEL[draft.kind]}’ 요청으로 이해했어요.\n\n“${draft.sourceText}”\n\n이 내용으로 접수할까요?`,
      ["접수할게요", "다시 말할게요", "취소"],
    );
  }

  const submenu: Record<string, string[]> = {
    "결석·보강": ["정규수업 결석", "방학특강 결석", "보강 예약", "조퇴 상담"],
    "셔틀": ["오늘 셔틀 안 타요", "오늘 다른 곳에서 타요", "정규 셔틀 신청·중단", "탑승 장소·시간 변경", "셔틀비 문의"],
    "청구·영수증": ["입금했어요", "청구 금액 확인", "영수증 요청", "환불·결제 취소 상담"],
    "수강 변경": ["반·요일·시간 변경", "수업 추가", "휴원", "복귀", "퇴원"],
    "정보·상담": ["연락처 변경", "기타 상담", "상담원 연결"],
  };
  if (submenu[text]) return kakaoText("원하시는 업무를 골라주세요. 직접 문장으로 말씀하셔도 돼요.", submenu[text]);

  const direct = DIRECT_REQUEST_LINKS[text];
  if (direct) {
    return kakaoText(
      `${direct.description}\n\n최초 인증 때 연결한 학부모 계정으로 안전하게 확인합니다.`,
      ["메뉴", "상담원 연결"],
      { label: direct.label, url: siteUrl(direct.path) },
    );
  }

  const kind = classifyParentUtterance(text);
  if (kind === "UNKNOWN" && /^(메뉴|처음|시작)$/.test(text)) {
    return kakaoText(`${parentDisplayName}, 무엇을 도와드릴까요? 평소처럼 문장으로 말씀하셔도 알아들을게요.`, ["결석·보강", "셔틀", "청구·영수증", "수강 변경", "정보·상담"]);
  }
  const directKind = DIRECT_KIND_LINKS[kind];
  if (directKind) {
    return kakaoText(
      `${directKind.description}\n\n“${text}” 요청을 정확한 정보로 접수하려면 아래 버튼을 눌러 확인해주세요.`,
      ["메뉴", "상담원 연결"],
      { label: directKind.label, url: siteUrl(directKind.path) },
    );
  }
  const child = selectChild(children, text);
  const intakeId = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, identity.id);
    if (providerRequestId) {
      const existing = await tx.$queryRawUnsafe<Array<IntakeRow & { studentName: string | null }>>(
        `SELECT r.id,r.kind,r."sourceText",r."studentId",r.status,s.name AS "studentName"
           FROM "KakaoParentIntake" r LEFT JOIN "Student" s ON s.id=r."studentId"
          WHERE r."identityId"=$1 AND r."providerRequestId"=$2 LIMIT 1`, identity.id, providerRequestId,
      );
      if (existing[0]) return { duplicate: existing[0] };
    }
    await tx.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake" SET status='CANCELED',"updatedAt"=now()
        WHERE "identityId"=$1 AND status IN ('DRAFT','NEEDS_DETAILS')`, identity.id,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "KakaoParentIntake"
        (id,"identityId","studentId",kind,"sourceText","structuredJson",status,"idempotencyKey","providerRequestId")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
      intakeId, identity.id, child?.id ?? null, kind, text,
      JSON.stringify(child ? { studentId: child.id, studentName: child.name, kind } : { kind }),
      child ? "DRAFT" : "NEEDS_DETAILS", `kakao:intake:${intakeId}`, providerRequestId ?? null,
    );
    return { duplicate: null };
  });
  if (created.duplicate) {
    const repeated = draftResponse(created.duplicate, created.duplicate.studentName);
    return repeated ?? kakaoText("이미 같은 요청을 확인하고 있어요. 자녀를 선택해 주세요.", children.slice(0, 10).map((item) => item.name));
  }
  if (!child) {
    return kakaoText("어느 자녀의 요청인지 알려주세요.", children.slice(0, 10).map((item) => item.name));
  }
  return kakaoText(
    `${child.name} 학생의 ‘${KIND_LABEL[kind]}’ 요청으로 이해했어요.\n\n“${text}”\n\n이 내용으로 접수할까요?`,
    ["접수할게요", "다시 말할게요", "취소"],
  );
}
