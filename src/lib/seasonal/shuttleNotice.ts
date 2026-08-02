import { prisma } from "@/lib/prisma";
import { getSavedDispatchRoute } from "./dispatchRoute";
import { getConfirmedShuttleRoster } from "./shuttleRoster";
import { buildNoticeBody, parseEtaMinutes, type NoticeTime } from "./shuttleNoticeFormat";

// 저장된 **등원(PICKUP)** 노선에서 학생별 안내 문자를 조립한다.
//
// 원칙:
//   · 노선은 요일 단위다. 요일마다 저장된 대표일 노선을 읽어 학생별 요일·시각을 모은다.
//   · 반드시 getSavedDispatchRoute를 통해 읽는다 — reconcile이 취소자 제거·라벨 갱신을
//     이미 해 주므로, payload를 직접 파싱하면 그 보정이 전부 빠진다.
//   · 문안은 **1인 1통**이다. 여러 학생을 한 통에 담으면 다른 집 아이 이름과 탑승 장소가
//     남의 학부모에게 노출된다(개인정보 유출). 절대 합치지 않는다.

export type ShuttleNoticePreview = {
  requestId: string;
  studentName: string;
  /** 마스킹된 수신번호(화면 표시용). 원본은 서버 밖으로 내보내지 않는다. */
  phoneMasked: string;
  /** 실제 발송 가능 여부. 번호가 없으면 false. */
  sendable: boolean;
  stopLabel: string;
  days: number[];
  message: string;
  /** 아직 시작 전이면 첫 등원일. */
  startsFrom: string | null;
  /** 문안을 만들 수 없을 때의 사유(발송 대상에서 빠진다). */
  skipReason?: string;
};

type Collected = {
  requestId: string; studentName: string;
  stopLabel: string; times: NoticeTime[];
};

function maskPhone(phone: string | null): string {
  const d = (phone ?? "").replace(/[^0-9]/g, "");
  if (d.length < 4) return "번호 없음";
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 저장된 등원 노선이 있는 날짜들(요일당 대표일 1건). */
async function savedPickupDates(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT DISTINCT ON (EXTRACT(DOW FROM "serviceDate"::date)) "serviceDate" AS d
       FROM "SeasonalDispatchRoute"
      WHERE "direction" = 'PICKUP'
      ORDER BY EXTRACT(DOW FROM "serviceDate"::date), "serviceDate" ASC`,
  );
  return rows.map((r) => String(r.d)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

/** 학생별 첫 등원 예정일(오늘보다 미래일 때만). 아직 시작 전인 학생 안내 문구에 쓴다. */
async function firstUpcomingSessionByRequestId(today: string): Promise<Map<string, string>> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT sr."shuttleRequestId" AS rid,
            MIN((sd."startsAt" AT TIME ZONE 'Asia/Seoul')::date)::text AS first_date
       FROM "SpecialProgramEnrollmentDate" e
       JOIN "SpecialProgramSessionDate" sd ON sd.id = e."sessionDateId"
       JOIN "SeasonalShuttleRoster" sr ON sr."applicationItemId" = e."applicationItemId"
      WHERE e.status = 'SCHEDULED'
        AND sr."removedAt" IS NULL AND sr.ride = true
      GROUP BY sr."shuttleRequestId"`,
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const rid = String(r.rid ?? ""), first = String(r.first_date ?? "");
    if (rid && /^\d{4}-\d{2}-\d{2}$/.test(first) && first > today) map.set(rid, first);
  }
  return map;
}

/**
 * 발송 전 미리보기 목록을 만든다. **문자를 보내지 않는다**(순수 조회).
 * @param today 'YYYY-MM-DD' — "아직 시작 전" 판정 기준일.
 */
export async function buildShuttleNoticePreviews(today: string): Promise<ShuttleNoticePreview[]> {
  const dates = await savedPickupDates();
  const collected = new Map<string, Collected>();

  for (const date of dates) {
    const saved = await getSavedDispatchRoute(date, "PICKUP");
    if (!saved) continue;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const v of saved.vehicles as Record<string, unknown>[]) {
      const stops = Array.isArray(v?.stops) ? (v.stops as Record<string, unknown>[]) : [];
      for (const s of stops) {
        const minutes = parseEtaMinutes(s.etaLabel as string | null);
        const students = Array.isArray(s.students) ? (s.students as Record<string, unknown>[]) : [];
        for (const st of students) {
          // 그날 결석 표시된 학생도 안내 대상이다 — 문자는 "요일별 시간표" 안내이지
          // "오늘 타는지" 안내가 아니다. 결석은 그날 하루의 사정일 뿐이다.
          const rid = st.requestId == null ? "" : String(st.requestId);
          if (!rid || minutes == null) continue;
          const cur = collected.get(rid);
          if (cur) cur.times.push({ dow, minutes });
          else collected.set(rid, {
            requestId: rid,
            studentName: String(st.name ?? ""),
            stopLabel: String(s.label ?? ""),
            times: [{ dow, minutes }],
          });
        }
      }
    }
  }

  const roster = await getConfirmedShuttleRoster();
  const phoneByRid = new Map<string, string | null>();
  for (const row of roster) phoneByRid.set(row.shuttleRequestId, row.parentPhone ?? null);
  const startsFromByRid = await firstUpcomingSessionByRequestId(today);

  const previews: ShuttleNoticePreview[] = [];
  for (const c of collected.values()) {
    const phone = phoneByRid.get(c.requestId) ?? null;
    const startsFrom = startsFromByRid.get(c.requestId) ?? null;
    let message = "", skipReason: string | undefined;
    try {
      message = buildNoticeBody({
        studentName: c.studentName, stopLabel: c.stopLabel, times: c.times, startsFrom,
      });
    } catch (e) {
      skipReason = e instanceof Error ? e.message : "문안을 만들지 못했습니다.";
    }
    const hasPhone = !!(phone && phone.replace(/[^0-9]/g, "").length >= 10);
    if (!hasPhone) skipReason = skipReason ?? "학부모 연락처가 없습니다.";
    previews.push({
      requestId: c.requestId,
      studentName: c.studentName,
      phoneMasked: maskPhone(phone),
      sendable: !skipReason,
      stopLabel: c.stopLabel,
      days: [...new Set(c.times.map((t) => t.dow))].sort((a, b) => a - b),
      message,
      startsFrom,
      skipReason,
    });
  }
  previews.sort((a, b) => a.studentName.localeCompare(b.studentName, "ko"));
  return previews;
}

/** 발송 시 필요한 실제 번호(서버 내부 전용). 미리보기에는 절대 싣지 않는다. */
export async function parentPhoneByRequestId(): Promise<Map<string, string | null>> {
  const roster = await getConfirmedShuttleRoster();
  const map = new Map<string, string | null>();
  for (const row of roster) map.set(row.shuttleRequestId, row.parentPhone ?? null);
  return map;
}
