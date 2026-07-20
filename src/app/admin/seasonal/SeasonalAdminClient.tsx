"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type SeasonStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
type ItemStatus = "PENDING" | "APPROVED" | "WAITLISTED" | "REJECTED" | "CANCELLED";

type SeasonalClass = {
  id: string;
  name: string;
  branch?: string | null;
  targetGrade?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  instructorName?: string | null;
  capacity: number;
  confirmedCount?: number;
  waitlistCount?: number;
  price: number;
  shuttleAvailable?: boolean;
};

type ShuttleRequest = {
  pickupLocation?: string | null;
  pickupTime?: string | null;
  dropoffLocation?: string | null;
  note?: string | null;
  status?: string | null;
  assignedRouteId?: string | null;
  assignedStopId?: string | null;
};

type Season = {
  id: string;
  name: string;
  status: SeasonStatus;
  enrollmentStartsAt?: string | null;
  enrollmentEndsAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  branch?: string | null;
  classes: SeasonalClass[];
};

type ApplicationItem = {
  id: string;
  classId: string;
  className: string;
  scheduleLabel?: string | null;
  status: ItemStatus;
  amount?: number;
  waitlistOrder?: number | null;
  shuttleRequest?: ShuttleRequest | null;
};

type Application = {
  id: string;
  childName: string;
  childBirthDate?: string | null;
  childGender?: string | null;
  childGrade?: string | null;
  childSchool?: string | null;
  childPhone?: string | null;
  parentName: string;
  parentPhone: string;
  parentRelation?: string | null;
  address?: string | null;
  status: string;
  createdAt: string;
  processedNote?: string | null;
  shuttleNeeded?: boolean;
  shuttleStatus?: string | null;
  paymentStatus?: string | null;
  totalAmount?: number;
  memo?: string | null;
  items: ApplicationItem[];
};

type Payload = {
  seasons: Season[];
  applications: Application[];
  stats?: { pending?: number; confirmed?: number; unpaid?: number; waitlisted?: number; shuttleUnassigned?: number };
};

type Tab = "overview" | "seasons" | "applications";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성 중", PUBLISHED: "모집 중", OPEN: "모집 중", CLOSED: "모집 마감", ARCHIVED: "보관",
  PENDING: "승인 대기", APPROVED: "승인", PAYMENT_PENDING: "결제 대기", CONFIRMED: "최종 확정", WAITLISTED: "대기", REJECTED: "반려", CANCELLED: "취소",
  PAID: "결제 완료", UNPAID: "미결제", REQUESTED: "요청", ASSIGNED: "배정 완료", UNASSIGNED: "미배정",
};

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "overview", label: "운영 현황", icon: "dashboard" },
  { key: "seasons", label: "시즌·반", icon: "calendar_month" },
  { key: "applications", label: "신청 관리", icon: "assignment_ind" },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "미정";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "미정";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function badge(status?: string | null) {
  const tone = status === "CONFIRMED" || status === "PAID" || status === "OPEN" || status === "ASSIGNED"
      || status === "APPROVED" || status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "WAITLISTED" || status === "PAYMENT_PENDING" || status === "UNPAID" || status === "UNASSIGNED"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  return `inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold ${tone}`;
}

export default function SeasonalAdminClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Payload>({ seasons: [], applications: [] });
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"season" | "class" | null>(null);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editingClass, setEditingClass] = useState<SeasonalClass | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/seasonal?includeApplications=true", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "방학특강 정보를 불러오지 못했습니다.");
      const seasons: Season[] = (body.seasons ?? []).map((season: Record<string, unknown>) => ({
        ...season,
        name: season.name ?? season.title ?? "이름 없는 시즌",
        enrollmentStartsAt: season.enrollmentStartsAt ?? season.applicationOpensAt,
        enrollmentEndsAt: season.enrollmentEndsAt ?? season.applicationClosesAt,
        classes: ((season.classes ?? season.offerings ?? []) as Array<Record<string, unknown>>).map((offering) => {
          const firstDate = (offering.sessionDates as Array<Record<string, unknown>> | undefined)?.[0];
          const startsAt = typeof firstDate?.startsAt === "string" ? new Date(firstDate.startsAt) : null;
          const endsAt = typeof firstDate?.endsAt === "string" ? new Date(firstDate.endsAt) : null;
          return {
            ...offering,
            name: offering.name ?? offering.title ?? "이름 없는 반",
            targetGrade: offering.targetGrade ?? offering.targetGrades,
            dayOfWeek: offering.dayOfWeek ?? (startsAt ? new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(startsAt) : "일정 미정"),
            startTime: offering.startTime ?? (startsAt ? startsAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""),
            endTime: offering.endTime ?? (endsAt ? endsAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""),
            confirmedCount: offering.confirmedCount ?? offering.approvedCount ?? 0,
          } as SeasonalClass;
        }),
      })) as Season[];
      const applications: Application[] = (body.applications ?? []).map((application: Record<string, unknown>) => {
        const items = ((application.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
          ...item,
          classId: item.classId ?? item.offeringId,
          className: item.className ?? item.titleSnapshot ?? (item.offering as Record<string, unknown> | undefined)?.title ?? "특강 반",
          amount: item.amount ?? item.priceSnapshot,
          waitlistOrder: item.waitlistOrder ?? null,
          shuttleRequest: (item.shuttleRequest ?? null) as ShuttleRequest | null,
        } as ApplicationItem));
        const shuttleRequests = [
          ...(((application.shuttleRequests as unknown[] | undefined) ?? []) as ShuttleRequest[]),
          ...items.map((item) => item.shuttleRequest).filter(Boolean) as ShuttleRequest[],
        ];
        const firstShuttle = shuttleRequests[0];
        return {
          ...application,
          totalAmount: application.totalAmount ?? application.totalPriceSnapshot,
          shuttleNeeded: application.shuttleNeeded !== undefined ? Boolean(application.shuttleNeeded) : shuttleRequests.length > 0,
          shuttleStatus: application.shuttleStatus ?? firstShuttle?.status ?? null,
          items,
        } as Application;
      });
      const payload: Payload = { seasons, applications, stats: body.stats };
      setData(payload);
      setSelectedSeasonId((current) => current || payload.seasons[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "방학특강 정보를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedSeason = data.seasons.find((season) => season.id === selectedSeasonId) ?? data.seasons[0];
  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.applications.filter((application) => {
      const matchesText = !query || [application.childName, application.parentName, application.parentPhone, application.childSchool].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "ALL" || application.items.some((item) => item.status === statusFilter) || application.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [data.applications, search, statusFilter]);

  const calculatedStats = {
    pending: data.stats?.pending ?? data.applications.filter((a) => a.items.some((i) => i.status === "PENDING")).length,
    confirmed: data.stats?.confirmed ?? data.applications.filter((a) => a.items.some((i) => i.status === "APPROVED")).length,
    unpaid: data.stats?.unpaid ?? data.applications.filter((a) => a.paymentStatus === "UNPAID" || a.paymentStatus === "PAYMENT_PENDING").length,
    waitlisted: data.stats?.waitlisted ?? data.applications.filter((a) => a.items.some((i) => i.status === "WAITLISTED")).length,
    shuttleUnassigned: data.stats?.shuttleUnassigned ?? data.applications.filter((a) => a.shuttleNeeded && a.shuttleStatus !== "ASSIGNED").length,
  };

  async function mutate(method: "POST" | "PATCH", body: Record<string, unknown>, success: string) {
    setError(""); setNotice("");
    const response = await fetch("/api/admin/seasonal", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
    setNotice(success); await load();
  }

  async function updateItem(itemId: string, status: ItemStatus) {
    try {
      await mutate("PATCH", { resource: "item", id: itemId, data: { status } }, `신청 항목을 '${STATUS_LABEL[status]}' 상태로 변경했습니다.`);
      setSelectedApplication((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, status } : item) } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "상태를 변경하지 못했습니다."); }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-20">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold text-[var(--brand-accent)]">SEASONAL PROGRAM</p><h1 className="mt-1 text-3xl font-black text-gray-950 dark:text-white">방학특강 운영</h1><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">모집부터 반 편성, 결제와 차량 현황까지 한곳에서 확인합니다.</p></div>
        <button type="button" onClick={() => { setEditingSeason(null); setModal("season"); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 font-black text-[var(--brand-accent-contrast)]"><Icon name="add" />새 시즌 만들기</button>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-900" aria-label="방학특강 관리 메뉴">
        {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${tab === item.key ? "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}><Icon name={item.icon} className="text-xl" />{item.label}</button>)}
      </nav>

      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><Icon name="check_circle" />{notice}</div>}
      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">다시 시도</button></div>}
      {loading ? <Loading /> : tab === "overview" ? <Overview stats={calculatedStats} seasons={data.seasons} applications={data.applications} onNavigate={setTab} /> : tab === "seasons" ? (
        <SeasonsView seasons={data.seasons} selected={selectedSeason} onSelect={setSelectedSeasonId} onAddClass={() => { setEditingClass(null); setModal("class"); }} onEditSeason={(season) => { setEditingSeason(season); setModal("season"); }} onEditClass={(klass) => { setEditingClass(klass); setModal("class"); }} onStatus={async (id, status) => { try { await mutate("PATCH", { resource: "season", id, data: { status } }, "시즌 상태를 변경했습니다."); } catch (caught) { setError(caught instanceof Error ? caught.message : "시즌 상태를 변경하지 못했습니다."); } }} />
      ) : <ApplicationsView applications={filteredApplications} search={search} status={statusFilter} onSearch={setSearch} onStatus={setStatusFilter} onSelect={setSelectedApplication} />}

      {selectedApplication && <ApplicationDrawer application={selectedApplication} onClose={() => setSelectedApplication(null)} onUpdateItem={updateItem} />}
      {modal === "season" && <SeasonForm initial={editingSeason} onClose={() => setModal(null)} onSubmit={async (payload) => { await mutate(editingSeason ? "PATCH" : "POST", editingSeason ? { resource: "season", id: editingSeason.id, data: payload } : { resource: "season", data: payload }, editingSeason ? "시즌 정보를 수정했습니다." : "새 시즌을 만들었습니다."); setModal(null); setTab("seasons"); }} />}
      {modal === "class" && selectedSeason && <ClassForm seasonId={selectedSeason.id} initial={editingClass} onClose={() => setModal(null)} onSubmit={async (payload) => { await mutate(editingClass ? "PATCH" : "POST", editingClass ? { resource: "offering", id: editingClass.id, data: payload } : { resource: "offering", data: { ...payload, seasonId: selectedSeason.id } }, editingClass ? "특강 반을 수정했습니다." : "특강 반을 추가했습니다."); setModal(null); }} />}
    </main>
  );
}

function Overview({ stats, seasons, applications, onNavigate }: { stats: Record<string, number>; seasons: Season[]; applications: Application[]; onNavigate: (tab: Tab) => void }) {
  const cards = [
    ["승인 대기", stats.pending, "pending_actions", "신청 관리"], ["승인 완료", stats.confirmed, "verified", "신청 관리"], ["미결제", stats.unpaid, "payments", "결제 관리 예정"], ["대기자", stats.waitlisted, "hourglass_top", "신청 관리"], ["차량 미배정", stats.shuttleUnassigned, "directions_bus", "차량 관리 예정"],
  ] as const;
  return <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, count, icon, helper]) => <button type="button" key={label} onClick={() => onNavigate(label === "승인 대기" || label === "대기자" ? "applications" : "overview")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 dark:border-gray-700 dark:bg-gray-900"><div className="flex items-center justify-between"><Icon name={icon} className="text-2xl text-[var(--brand-accent)]" /><span className="text-xs font-bold text-gray-400">{helper}</span></div><p className="mt-4 text-3xl font-black">{count}</p><p className="mt-1 text-sm font-bold text-gray-600 dark:text-gray-300">{label}</p></button>)}</section>
    <section className="grid gap-4 lg:grid-cols-2"><Panel title="운영 중인 시즌" icon="calendar_month">{seasons.length ? seasons.slice(0, 4).map((season) => <div key={season.id} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0 dark:border-gray-800"><div><p className="font-bold">{season.name}</p><p className="text-xs text-gray-500">{formatDate(season.startsAt)} ~ {formatDate(season.endsAt)} · {season.classes.length}개 반</p></div><span className={badge(season.status)}>{STATUS_LABEL[season.status] ?? season.status}</span></div>) : <Empty text="아직 개설된 시즌이 없습니다." />}</Panel>
    <Panel title="최근 신청" icon="person_add">{applications.length ? applications.slice(0, 5).map((application) => <div key={application.id} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0 dark:border-gray-800"><div><p className="font-bold">{application.childName} <span className="text-xs text-gray-400">{application.childGrade}</span></p><p className="text-xs text-gray-500">{application.parentName} · {application.items.length}개 반</p></div><span className={badge(application.items[0]?.status)}>{STATUS_LABEL[application.items[0]?.status] ?? "접수"}</span></div>) : <Empty text="접수된 신청이 없습니다." />}</Panel></section>
    <section className="grid gap-3 sm:grid-cols-3"><NextCard icon="payments" title="결제 관리" text="청구·미납·환불 화면은 다음 그룹에서 연결합니다." /><NextCard icon="directions_bus" title="차량 배차" text="승하차 요청과 노선 배정 화면을 연결할 예정입니다." /><NextCard icon="analytics" title="운영 통계" text="매출·출석·취소 지표를 시즌별로 제공합니다." /></section></div>;
}

function SeasonsView({ seasons, selected, onSelect, onAddClass, onEditSeason, onEditClass, onStatus }: { seasons: Season[]; selected?: Season; onSelect: (id: string) => void; onAddClass: () => void; onEditSeason: (season: Season) => void; onEditClass: (klass: SeasonalClass) => void; onStatus: (id: string, status: SeasonStatus) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><Panel title="시즌 목록" icon="event_note"><div className="space-y-2">{seasons.map((season) => <button type="button" key={season.id} onClick={() => onSelect(season.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === season.id ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]" : "border-gray-200 dark:border-gray-700"}`}><p className="font-bold">{season.name}</p><p className="mt-1 text-xs text-gray-500">{STATUS_LABEL[season.status]} · {season.classes.length}개 반</p></button>)}{!seasons.length && <Empty text="개설된 시즌이 없습니다." />}</div></Panel>
    <Panel title={selected?.name ?? "시즌을 선택하세요"} icon="view_week" action={selected && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEditSeason(selected)} className="min-h-10 rounded-lg border border-gray-200 px-3 text-sm font-bold dark:border-gray-700">시즌 수정</button><select aria-label="시즌 상태" value={selected.status} onChange={(event) => void onStatus(selected.id, event.target.value as SeasonStatus)} className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-800">{["DRAFT","PUBLISHED","CLOSED","ARCHIVED"].map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}</select><button type="button" onClick={onAddClass} className="min-h-10 rounded-lg bg-[var(--brand-accent)] px-3 text-sm font-black text-[var(--brand-accent-contrast)]">반 추가</button></div>}>
      {selected ? <><div className="mb-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3 dark:bg-gray-800"><p><span className="block text-xs text-gray-500">모집 기간</span>{formatDate(selected.enrollmentStartsAt)} ~ {formatDate(selected.enrollmentEndsAt)}</p><p><span className="block text-xs text-gray-500">운영 기간</span>{formatDate(selected.startsAt)} ~ {formatDate(selected.endsAt)}</p><p><span className="block text-xs text-gray-500">지점</span>{selected.branch || "전체"}</p></div><div className="space-y-3">{selected.classes.map((klass) => { const confirmed = klass.confirmedCount ?? 0; const percent = Math.min(100, klass.capacity ? confirmed / klass.capacity * 100 : 0); return <article key={klass.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{klass.name}</h3>{klass.shuttleAvailable && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">셔틀</span>}</div><p className="mt-1 text-sm text-gray-500">{klass.dayOfWeek} {klass.startTime}~{klass.endTime} · {klass.targetGrade || "전체 학년"} · {klass.instructorName || "담당자 미정"}</p></div><div className="text-right"><p className="font-black">{klass.price.toLocaleString()}원</p><p className="text-xs text-gray-500">확정 {confirmed}/{klass.capacity} · 대기 {klass.waitlistCount ?? 0}</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-full rounded-full bg-[var(--brand-accent)]" style={{ width: `${percent}%` }} /></div></article>; })}{!selected.classes.length && <Empty text="아직 개설된 반이 없습니다. '반 추가'를 눌러 시작하세요." />}</div></> : <Empty text="왼쪽에서 시즌을 선택하세요." />}
      {selected && selected.classes.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">{selected.classes.map((klass) => <button type="button" key={klass.id} onClick={() => onEditClass(klass)} className="min-h-10 rounded-lg border border-gray-200 px-3 text-xs font-bold dark:border-gray-700">{klass.name} 수정</button>)}</div>}
    </Panel></div>;
}

function ApplicationsView({ applications, search, status, onSearch, onStatus, onSelect }: { applications: Application[]; search: string; status: string; onSearch: (value: string) => void; onStatus: (value: string) => void; onSelect: (application: Application) => void }) {
  return <Panel title="신청 목록" icon="assignment_ind"><div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Icon name="search" className="absolute left-3 top-3 text-xl text-gray-400" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="학생·학부모·전화번호 검색" className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 dark:border-gray-700 dark:bg-gray-800" /></label><select aria-label="신청 상태" value={status} onChange={(event) => onStatus(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800"><option value="ALL">전체 상태</option>{["PENDING","APPROVED","WAITLISTED","REJECTED","CANCELLED"].map((value) => <option value={value} key={value}>{STATUS_LABEL[value]}</option>)}</select></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800"><tr><th className="px-4 py-3">학생</th><th className="px-4 py-3">학부모</th><th className="px-4 py-3">신청 반</th><th className="px-4 py-3">결제</th><th className="px-4 py-3">셔틀</th><th className="px-4 py-3">접수일</th><th className="px-4 py-3"><span className="sr-only">상세</span></th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{applications.map((application) => <tr key={application.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-4 py-4"><button type="button" onClick={() => onSelect(application)} className="font-black hover:underline">{application.childName}</button><p className="text-xs text-gray-500">{application.childGrade} {application.childSchool}</p></td><td className="px-4 py-4"><p className="font-bold">{application.parentName}</p><a href={`tel:${application.parentPhone}`} className="text-xs text-[var(--brand-accent)] hover:underline">{application.parentPhone}</a></td><td className="px-4 py-4"><p>{application.items.length}개</p><div className="mt-1 flex flex-wrap gap-1">{application.items.slice(0,2).map((item) => <span key={item.id} className={badge(item.status)}>{STATUS_LABEL[item.status]}</span>)}</div></td><td className="px-4 py-4"><span className={badge(application.paymentStatus)}>{STATUS_LABEL[application.paymentStatus || ""] ?? application.paymentStatus ?? "청구 전"}</span><p className="mt-1 text-xs">{(application.totalAmount ?? 0).toLocaleString()}원</p></td><td className="px-4 py-4">{application.shuttleNeeded ? <span className={badge(application.shuttleStatus || "UNASSIGNED")}>{STATUS_LABEL[application.shuttleStatus || "UNASSIGNED"]}</span> : "미이용"}</td><td className="px-4 py-4 text-gray-500">{formatDate(application.createdAt)}</td><td className="px-4 py-4"><button type="button" onClick={() => onSelect(application)} className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 px-3 font-bold dark:border-gray-700">상세</button></td></tr>)}{!applications.length && <tr><td colSpan={7}><Empty text="조건에 맞는 신청이 없습니다." /></td></tr>}</tbody></table></div>
  </Panel>;
}

function ApplicationDrawer({ application, onClose, onUpdateItem }: { application: Application; onClose: () => void; onUpdateItem: (id: string, status: ItemStatus) => Promise<void> }) {
  const totalAmount = application.totalAmount ?? application.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const parentPhoneHref = application.parentPhone ? `tel:${application.parentPhone}` : undefined;
  const parentSmsHref = application.parentPhone ? `sms:${application.parentPhone}` : undefined;

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-labelledby="application-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-7">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--brand-accent)]">신청 상세</p>
          <h2 id="application-title" className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{application.childName} <span className="text-base text-gray-400">{application.childGrade || "학년 미입력"}</span></h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={badge(application.status)}>{STATUS_LABEL[application.status] ?? application.status}</span>
            <span className={badge(application.paymentStatus)}>{STATUS_LABEL[application.paymentStatus || ""] ?? application.paymentStatus ?? "청구 전"}</span>
            {application.shuttleNeeded && <span className={badge(application.shuttleStatus || "REQUESTED")}>셔틀 {STATUS_LABEL[application.shuttleStatus || "REQUESTED"]}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><Icon name="close" /></button>
      </header>

      <section className="mt-6 grid gap-3 rounded-2xl bg-gray-50 p-4 text-sm dark:bg-gray-800 sm:grid-cols-2">
        <Info label="학부모">{application.parentName}{application.parentRelation ? ` · ${application.parentRelation}` : ""}</Info>
        <Info label="학부모 연락처">{application.parentPhone || "미입력"}</Info>
        <Info label="학생 정보">{[formatDate(application.childBirthDate), application.childGender, application.childPhone].filter(Boolean).join(" · ") || "미입력"}</Info>
        <Info label="학교">{[application.childSchool, application.childGrade].filter(Boolean).join(" · ") || "미입력"}</Info>
        <Info label="접수일">{formatDateTime(application.createdAt)}</Info>
        <Info label="예상 금액">{totalAmount.toLocaleString()}원</Info>
        {application.address && <div className="sm:col-span-2"><Info label="주소">{application.address}</Info></div>}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={parentPhoneHref} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 font-bold text-gray-900 dark:border-gray-700 dark:text-white"><Icon name="call" />전화</a>
        <a href={parentSmsHref} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 font-bold text-gray-900 dark:border-gray-700 dark:text-white"><Icon name="sms" />문자</a>
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-950 dark:text-white">신청 항목별 처리</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">요일별로 승인·대기·반려·취소를 따로 처리할 수 있습니다.</p>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{application.items.length}개 반 신청</span>
        </div>
        <div className="mt-3 space-y-3">
          {application.items.map((item) => <ApplicationItemCard key={item.id} item={item} onUpdateItem={onUpdateItem} />)}
        </div>
      </section>

      {application.memo && <section className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="text-sm font-black text-gray-950 dark:text-white">요청사항</h3><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{application.memo}</p></section>}
      {application.processedNote && <section className="mt-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="text-sm font-black text-gray-950 dark:text-white">처리 메모</h3><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{application.processedNote}</p></section>}
    </aside>
  </div>;
}

function ApplicationItemCard({ item, onUpdateItem }: { item: ApplicationItem; onUpdateItem: (id: string, status: ItemStatus) => Promise<void> }) {
  const quickStatuses: ItemStatus[] = ["APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"];
  return <article className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-black text-gray-950 dark:text-white">{item.className}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.scheduleLabel || "일정 미정"} · {(item.amount ?? 0).toLocaleString()}원</p>
        {item.waitlistOrder && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">대기 {item.waitlistOrder}번</p>}
      </div>
      <span className={badge(item.status)}>{STATUS_LABEL[item.status]}</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {quickStatuses.map((status) => <button key={status} type="button" disabled={item.status === status} onClick={() => void onUpdateItem(item.id, status)} className={`min-h-10 rounded-xl border px-3 text-sm font-black ${item.status === status ? "border-transparent bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)]" : "border-gray-200 text-gray-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] dark:border-gray-700 dark:text-gray-200"}`}>{STATUS_LABEL[status]}</button>)}
    </div>
    <label className="mt-4 block text-xs font-bold text-gray-500 dark:text-gray-400">
      상태 직접 변경
      <select value={item.status} onChange={(event) => void onUpdateItem(item.id, event.target.value as ItemStatus)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
        {["PENDING","APPROVED","WAITLISTED","REJECTED","CANCELLED"].map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
      </select>
    </label>
    {item.shuttleRequest && <ShuttleRequestBox request={item.shuttleRequest} />}
  </article>;
}

function ShuttleRequestBox({ request }: { request: ShuttleRequest }) {
  return <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-black text-blue-900 dark:text-blue-100">셔틀 요청</h4>
      <span className={badge(request.status || "REQUESTED")}>{STATUS_LABEL[request.status || "REQUESTED"]}</span>
    </div>
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      <Info label="탑승 위치">{request.pickupLocation || "미입력"}</Info>
      <Info label="희망 시간">{request.pickupTime || "미입력"}</Info>
      <Info label="하차 위치">{request.dropoffLocation || "미입력"}</Info>
      <Info label="배정">{request.assignedRouteId || request.assignedStopId ? [request.assignedRouteId, request.assignedStopId].filter(Boolean).join(" · ") : "미배정"}</Info>
    </dl>
    {request.note && <p className="mt-3 whitespace-pre-wrap text-xs text-blue-900 dark:text-blue-100">{request.note}</p>}
  </div>;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <p><span className="block text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span><b className="font-bold text-gray-900 dark:text-white">{children}</b></p>;
}

function SeasonForm({ initial: _initial, onClose, onSubmit }: { initial?: Season | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  void _initial;
  return <FormModal title="새 방학특강 시즌" onClose={onClose} onSubmit={onSubmit} fields={[{name:"title",label:"시즌명",placeholder:"예: 2026 여름방학 특강",required:true},{name:"slug",label:"홈페이지 주소",placeholder:"예: 2026-summer",required:true},{name:"applicationOpensAt",label:"모집 시작일",type:"date",required:true},{name:"applicationClosesAt",label:"모집 종료일",type:"date",required:true},{name:"startsAt",label:"수업 시작일",type:"date",required:true},{name:"endsAt",label:"수업 종료일",type:"date",required:true}]} />;
}

function ClassForm({ seasonId, initial: _initial, onClose, onSubmit }: { seasonId: string; initial?: SeasonalClass | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  void _initial;
  return <FormModal title="특강 반 추가" onClose={onClose} onSubmit={(payload) => onSubmit({ ...payload, seasonId, capacity: Number(payload.capacity), price: Number(payload.price), status: "DRAFT" })} fields={[{name:"code",label:"반 코드",placeholder:"예: MON-1",required:true},{name:"title",label:"반 이름",placeholder:"예: 초등 고학년 1교시",required:true},{name:"targetGrades",label:"대상",placeholder:"예: 초등 4~6학년",required:true},{name:"location",label:"수업 장소",placeholder:"예: 다산점"},{name:"capacity",label:"정원",type:"number",required:true},{name:"price",label:"수강료",type:"number",required:true},{name:"instructorName",label:"담당 선생님",placeholder:"미정이면 비워두세요"}]} />;
}

type Field = { name: string; label: string; type?: string; placeholder?: string; required?: boolean };
function FormModal({ title, fields, onClose, onSubmit }: { title: string; fields: Field[]; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries()); try { await onSubmit(payload); } catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다."); setPending(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"><header className="flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button type="button" onClick={onClose} aria-label="닫기"><Icon name="close" /></button></header>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.name} className="text-sm font-bold text-gray-700 dark:text-gray-200">{field.label}{field.required && <span className="text-red-500"> *</span>}<input name={field.name} type={field.type || "text"} required={field.required} placeholder={field.placeholder} min={field.type === "number" ? 0 : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal text-gray-950 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>)}</div><footer className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-gray-200 px-4 font-bold dark:border-gray-700">취소</button><button disabled={pending} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-60">{pending ? "저장 중…" : "저장"}</button></footer></form></div>;
}

function Panel({ title, icon, action, children }: { title: string; icon: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"><header className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center dark:border-gray-800"><h2 className="flex items-center gap-2 font-black"><Icon name={icon} className="text-[var(--brand-accent)]" />{title}</h2>{action}</header><div className="p-5">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center"><Icon name="inbox" className="text-4xl text-gray-300" /><p className="mt-2 text-sm text-gray-500">{text}</p></div>; }
function NextCard({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900"><Icon name={icon} className="text-2xl text-gray-400" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-gray-500">{text}</p><span className="mt-3 inline-block text-xs font-bold text-[var(--brand-accent)]">다음 단계에서 연결</span></div>; }
function Loading() { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>; }
