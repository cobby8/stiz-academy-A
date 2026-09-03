"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { issuePendingReconfirmationLink } from "@/lib/kakao-parent-chatbot";

/** 관리자 미리보기만 생성한다. 링크 생성은 발송 승인이나 발송 완료가 아니다. */
export async function prepareKakaoReconfirmationNotice(intakeId: string) {
  const admin = await requireAdmin();
  if (typeof intakeId !== "string" || !intakeId.trim() || intakeId.length > 100) throw new Error("요청을 선택해 주세요.");
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; parentUserId: string; status: string }>>(
    `SELECT i.id,i."parentUserId",i.status FROM "KakaoParentIdentity" i
      JOIN "KakaoParentIntake" r ON r."identityId"=i.id
      WHERE r.id=$1 AND r.status='APPROVED' AND i.status='ACTIVE' AND i."parentUserId" IS NOT NULL`, intakeId,
  );
  if (!rows[0]) throw new Error("인증된 학부모의 이관 요청만 안내를 준비할 수 있습니다.");
  const link = await issuePendingReconfirmationLink(rows[0], intakeId, admin.appUserId);
  if (!link) throw new Error("재확인이 필요 없거나 요청 내용이 변경되었습니다. 새로고침해 주세요.");
  return {
    ...link,
    status: "HELD" as const,
    sent: false as const,
    message: `안녕하세요 어머니~ ${link.studentName} 학생 요청 내용을 확인해 정리했습니다. 아래 링크에서 날짜와 수업 등 내용을 확인해 주세요.\n${link.url}\n확인 후 원장 승인과 처리 결과 확인을 거쳐 반영됩니다. 링크는 24시간 동안 사용할 수 있습니다.`,
  };
}
