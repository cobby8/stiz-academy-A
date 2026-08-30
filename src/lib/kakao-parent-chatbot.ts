import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  classifyParentUtterance,
  getKakaoUserKey,
  type KakaoSkillPayload,
  type ParentRequestKind,
} from "@/lib/kakao-chatbot-contract";

export { classifyParentUtterance, getKakaoUserKey } from "@/lib/kakao-chatbot-contract";
export type { KakaoSkillPayload, ParentRequestKind } from "@/lib/kakao-chatbot-contract";

const LINK_TTL_MS = 15 * 60_000;
const CONFIRM_WORDS = /^(접수|접수할게요|확인|네|예|맞아요|진행)$/;
const CANCEL_WORDS = /^(취소|아니요|다시|접수 취소)$/;

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
    `SELECT id, "parentUserId", status FROM "KakaoParentIdentity"
      WHERE "botId"=$1 AND "userKeyHash"=$2 LIMIT 1`, botId, digest(userKey),
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

export async function handleLinkedMessage(identity: IdentityRow, utterance: string) {
  const text = utterance.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!identity.parentUserId) throw new Error("IDENTITY_NOT_LINKED");
  const children = await childrenOf(identity.parentUserId);
  if (children.length === 0) return kakaoText("연결된 수강생을 찾지 못했어요. 학원으로 문의해 주세요.", ["상담원 연결"]);

  const draft = await latestDraft(identity.id);
  if (draft && CANCEL_WORDS.test(text)) {
    await prisma.$executeRawUnsafe(`UPDATE "KakaoParentIntake" SET status='CANCELED',"updatedAt"=now() WHERE id=$1 AND status IN ('DRAFT','NEEDS_DETAILS')`, draft.id);
    return kakaoText("작성 중인 요청을 취소했어요. 새로 말씀해 주세요.", ["결석·보강", "셔틀", "청구·영수증", "수강 변경", "정보·상담"]);
  }
  if (draft && CONFIRM_WORDS.test(text)) {
    const changed = Number(await prisma.$executeRawUnsafe(
      `UPDATE "KakaoParentIntake" SET status='SUBMITTED',"confirmedAt"=now(),"updatedAt"=now()
        WHERE id=$1 AND status IN ('DRAFT','NEEDS_DETAILS')`, draft.id,
    ));
    if (changed === 0) return kakaoText("이미 접수된 요청이에요.");
    return kakaoText(`${KIND_LABEL[draft.kind]} 요청을 접수했어요. 원장님이 확인한 뒤 필요한 경우 카카오톡이나 전화로 연락드릴게요.`);
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

  const kind = classifyParentUtterance(text);
  if (kind === "UNKNOWN" && /^(메뉴|처음|시작)$/.test(text)) {
    return kakaoText("무엇을 도와드릴까요? 평소처럼 문장으로 말씀하셔도 알아들을게요.", ["결석·보강", "셔틀", "청구·영수증", "수강 변경", "정보·상담"]);
  }
  const child = selectChild(children, text);
  if (!child) {
    const intakeId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KakaoParentIntake"
        (id,"identityId",kind,"sourceText","structuredJson",status,"idempotencyKey")
       VALUES ($1,$2,$3,$4,$5::jsonb,'NEEDS_DETAILS',$6)`,
      intakeId, identity.id, kind, text, JSON.stringify({ kind }), `kakao:intake:${intakeId}`,
    );
    return kakaoText("어느 자녀의 요청인지 알려주세요.", children.slice(0, 10).map((item) => item.name));
  }

  const intakeId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "KakaoParentIntake"
      (id,"identityId","studentId",kind,"sourceText","structuredJson",status,"idempotencyKey")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,'DRAFT',$7)`,
    intakeId, identity.id, child.id, kind, text,
    JSON.stringify({ studentId: child.id, studentName: child.name, kind }),
    `kakao:intake:${intakeId}`,
  );
  return kakaoText(
    `${child.name} 학생의 ‘${KIND_LABEL[kind]}’ 요청으로 이해했어요.\n\n“${text}”\n\n이 내용으로 접수할까요?`,
    ["접수할게요", "다시 말할게요", "취소"],
  );
}
