"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AdminModal from "@/components/admin/AdminModal";
import { seoulDateTimeToIso } from "./seasonalDateTime";

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
  instructorId?: string | null;
  capacity: number;
  confirmedCount?: number;
  waitlistCount?: number;
  price: number;
  code?: string | null;
  targetGrades?: string | null;
  location?: string | null;
  newApplicantPrice?: number | null;
  existingApplicantPrice?: number | null;
  shuttleAvailable?: boolean;
  status?: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  linkedProgramId?: string | null;
  linkedClassId?: string | null;
  sessionDates?: Array<{
    id?: string;
    startsAt: string;
    endsAt: string;
    location?: string | null;
    note?: string | null;
  }>;
};

type ShuttleRequest = {
  pickupLocation?: string | null;
  pickupAddress?: string | null;
  pickupRoadAddress?: string | null;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  pickupPlaceId?: string | null;
  pickupLocationSource?: string | null;
  pickupAccuracyMeters?: number | string | null;
  pickupConfirmedAt?: string | null;
  pickupTime?: string | null;
  dropoffLocation?: string | null;
  dropoffAddress?: string | null;
  dropoffRoadAddress?: string | null;
  dropoffLatitude?: number | string | null;
  dropoffLongitude?: number | string | null;
  dropoffPlaceId?: string | null;
  dropoffLocationSource?: string | null;
  dropoffAccuracyMeters?: number | string | null;
  dropoffConfirmedAt?: string | null;
  locationConsentVersion?: string | null;
  note?: string | null;
  status?: string | null;
  assignedRouteId?: string | null;
  assignedStopId?: string | null;
};

type InvoiceInfo = {
  id: string;
  paymentId: string;
  invoiceNo?: string | null;
  status?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  checkoutUrl?: string | null;
};

type Season = {
  id: string;
  name: string;
  slug?: string | null;
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
  linkedProgramId?: string | null;
  linkedClassId?: string | null;
  enrollmentId?: string | null;
  paymentId?: string | null;
  invoice?: InvoiceInfo | null;
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
  applicantType?: "NEW" | "EXISTING" | string | null;
  selectedWeekdays?: string[];
  importSource?: string | null;
  imported?: boolean;
  reviewReasons?: string[];
  items: ApplicationItem[];
};

type ShuttlePointKind = "pickup" | "dropoff";

type Payload = {
  seasons: Season[];
  applications: Application[];
  stats?: { pending?: number; confirmed?: number; unpaid?: number; waitlisted?: number; shuttleUnassigned?: number };
};

type BulkItemResult = {
  itemId: string;
  ok: boolean;
  status?: string;
  applicationId?: string;
  message?: string;
  code?: string;
};

type BulkItemResponse = {
  success?: boolean;
  summary?: { total?: number; succeeded?: number; failed?: number };
  results?: BulkItemResult[];
  error?: string;
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

const BULK_ITEM_STATUSES: ItemStatus[] = ["APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"];

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

function getItemInvoiceHref(item: Pick<ApplicationItem, "invoice">) {
  if (item.invoice?.checkoutUrl) return item.invoice.checkoutUrl;
  if (!item.invoice?.id) return null;
  return `/payments/${encodeURIComponent(item.invoice.id)}`;
}

function toAbsoluteHref(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  const normalizedHref = href.startsWith("/") ? href : `/${href}`;
  return `${window.location.origin}${normalizedHref}`;
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

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return value.split(/[,/]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function applicantTypeLabel(value?: string | null) {
  if (value === "NEW") return "신규";
  if (value === "EXISTING") return "기존";
  return value || "구분 미확인";
}

function paymentReviewLabel(value?: string | null) {
  if (!value || value === "PAYMENT_PENDING" || value === "UNPAID") return "결제 확인 전";
  return STATUS_LABEL[value] ?? value;
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
  const [convertingItemId, setConvertingItemId] = useState("");
  const [resolvingReview, setResolvingReview] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkProcessingStatus, setBulkProcessingStatus] = useState<ItemStatus | "">("");
  const [bulkConverting, setBulkConverting] = useState(false);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && TABS.some((item) => item.key === requestedTab)) setTab(requestedTab as Tab);
  }, []);

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
        const items = ((application.items ?? []) as Array<Record<string, unknown>>).map((item) => {
          const offering = item.offering as Record<string, unknown> | undefined;
          return {
            ...item,
            classId: item.classId ?? item.offeringId,
            className: item.className ?? item.titleSnapshot ?? offering?.title ?? "특강 반",
            amount: item.amount ?? item.priceSnapshot,
            waitlistOrder: item.waitlistOrder ?? null,
            linkedProgramId: item.linkedProgramId ?? offering?.linkedProgramId ?? null,
            linkedClassId: item.linkedClassId ?? offering?.linkedClassId ?? null,
            enrollmentId: item.enrollmentId ?? null,
            paymentId: item.paymentId ?? null,
            invoice: (item.invoice ?? null) as InvoiceInfo | null,
            shuttleRequest: (item.shuttleRequest ?? null) as ShuttleRequest | null,
          } as ApplicationItem;
        });
        const shuttleRequests = [
          ...(((application.shuttleRequests as unknown[] | undefined) ?? []) as ShuttleRequest[]),
          ...items.map((item) => item.shuttleRequest).filter(Boolean) as ShuttleRequest[],
        ];
        const firstShuttle = shuttleRequests[0];
        const applicantType = application.applicantType ?? application.memberType ?? application.customerType;
        const selectedWeekdays = stringList(application.selectedWeekdays ?? application.weekdays ?? application.selectedDays);
        const importSource = application.importSource ?? application.sourceLabel ?? application.source;
        const reviewReasons = stringList(application.reviewReasons ?? application.needsReviewReasons ?? application.reviewReason);
        return {
          ...application,
          totalAmount: application.totalAmount ?? application.totalPriceSnapshot,
          shuttleNeeded: application.shuttleNeeded !== undefined ? Boolean(application.shuttleNeeded) : shuttleRequests.length > 0,
          shuttleStatus: application.shuttleStatus ?? firstShuttle?.status ?? null,
          applicantType: typeof applicantType === "string" ? applicantType : null,
          selectedWeekdays,
          importSource: typeof importSource === "string" ? importSource : null,
          imported: Boolean(application.imported ?? application.isImported ?? importSource),
          reviewReasons,
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
  const visibleItemIds = useMemo(() => filteredApplications.flatMap((application) => application.items.map((item) => item.id)), [filteredApplications]);
  const visibleItemIdSet = useMemo(() => new Set(visibleItemIds), [visibleItemIds]);
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedApplicationCount = useMemo(
    () => filteredApplications.filter((application) => application.items.some((item) => selectedItemIdSet.has(item.id))).length,
    [filteredApplications, selectedItemIdSet],
  );
  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((itemId) => selectedItemIdSet.has(itemId));

  useEffect(() => {
    setSelectedItemIds((current) => {
      const next = current.filter((itemId) => visibleItemIdSet.has(itemId));
      return next.length === current.length ? current : next;
    });
  }, [visibleItemIdSet]);

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

  async function convertItem(itemId: string) {
    setConvertingItemId(itemId);
    try {
      await mutate("PATCH", { resource: "conversion", id: itemId, data: {} }, "수강 등록과 청구서를 생성했습니다.");
      setSelectedApplication(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수강·청구 생성에 실패했습니다.");
    } finally {
      setConvertingItemId("");
    }
  }

  function toggleApplicationSelection(application: Application, checked: boolean) {
    const itemIds = application.items.map((item) => item.id);
    setSelectedItemIds((current) => {
      const next = new Set(current);
      for (const itemId of itemIds) {
        if (checked) next.add(itemId);
        else next.delete(itemId);
      }
      return Array.from(next);
    });
  }

  function toggleAllVisibleApplications(checked: boolean) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      for (const itemId of visibleItemIds) {
        if (checked) next.add(itemId);
        else next.delete(itemId);
      }
      return Array.from(next);
    });
  }

  async function handleBulkItemStatus(status: ItemStatus) {
    if (selectedItemIds.length === 0) return;
    const targetLabel = STATUS_LABEL[status] ?? status;
    const confirmed = window.confirm(`${selectedApplicationCount}명, 신청 반 ${selectedItemIds.length}개를 '${targetLabel}' 처리할까요?`);
    if (!confirmed) return;

    setBulkProcessingStatus(status);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/seasonal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "bulkItems", data: { itemIds: selectedItemIds, status } }),
      });
      const body = (await response.json().catch(() => ({}))) as BulkItemResponse;
      if (!response.ok) throw new Error(body.error || "일괄 처리를 완료하지 못했습니다.");

      const results = body.results ?? [];
      const failed = results.filter((result) => !result.ok);
      const succeeded = body.summary?.succeeded ?? results.filter((result) => result.ok).length;
      const failedIds = failed.map((result) => result.itemId);
      const failureMessage = failed[0]?.message ? ` 첫 실패 사유: ${failed[0].message}` : "";
      setSelectedItemIds(failedIds);
      setNotice(`${targetLabel} 일괄 처리: ${succeeded}개 완료, ${failed.length}개 실패.${failureMessage}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "일괄 처리를 완료하지 못했습니다.");
    } finally {
      setBulkProcessingStatus("");
    }
  }

  async function handleBulkConversion() {
    if (selectedItemIds.length === 0) return;
    const confirmed = window.confirm(`${selectedApplicationCount}명, 신청 반 ${selectedItemIds.length}개의 수강 등록과 청구서를 생성할까요? 승인되지 않은 항목은 실패 사유로 남습니다.`);
    if (!confirmed) return;

    setBulkConverting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/seasonal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "bulkConversion", data: { itemIds: selectedItemIds } }),
      });
      const body = (await response.json().catch(() => ({}))) as BulkItemResponse;
      if (!response.ok) throw new Error(body.error || "수강·청구 생성을 완료하지 못했습니다.");

      const results = body.results ?? [];
      const failed = results.filter((result) => !result.ok);
      const succeeded = body.summary?.succeeded ?? results.filter((result) => result.ok).length;
      const failureMessage = failed[0]?.message ? ` 첫 실패 사유: ${failed[0].message}` : "";
      setSelectedItemIds(failed.map((result) => result.itemId));
      setNotice(`수강·청구 생성: ${succeeded}개 완료, ${failed.length}개 실패.${failureMessage}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수강·청구 생성을 완료하지 못했습니다.");
    } finally {
      setBulkConverting(false);
    }
  }

  async function copyInvoiceLink(item: ApplicationItem) {
    const href = getItemInvoiceHref(item);
    if (!href) {
      setNotice("먼저 청구서를 생성해야 링크를 복사할 수 있습니다.");
      return;
    }
    const absoluteHref = toAbsoluteHref(href);
    try {
      await navigator.clipboard.writeText(absoluteHref);
      setNotice(`${item.className} 청구서 링크를 복사했습니다.`);
    } catch {
      window.open(absoluteHref, "_blank", "noopener,noreferrer");
      setNotice("브라우저가 복사를 막아 청구서를 새 창으로 열었습니다.");
    }
  }

  async function resolveApplicationReview(applicationId: string, reviewNote: string) {
    setResolvingReview(true);
    try {
      await mutate("PATCH", { resource: "applicationReview", id: applicationId, data: { action: "CLEAR", reviewNote } }, "확인 필요 항목을 검토 완료로 처리했습니다.");
      setSelectedApplication((current) => current?.id === applicationId ? { ...current, reviewReasons: [] } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검토 완료 처리에 실패했습니다.");
    } finally {
      setResolvingReview(false);
    }
  }

  return (
    <main className="mx-auto min-w-0 max-w-7xl space-y-6 overflow-x-clip pb-20">
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
      ) : <ApplicationsView applications={filteredApplications} search={search} status={statusFilter} selectedItemIdSet={selectedItemIdSet} selectedItemCount={selectedItemIds.length} selectedApplicationCount={selectedApplicationCount} allVisibleSelected={allVisibleSelected} bulkProcessingStatus={bulkProcessingStatus} bulkConverting={bulkConverting} onSearch={setSearch} onStatus={setStatusFilter} onSelect={setSelectedApplication} onToggleApplication={toggleApplicationSelection} onToggleAll={toggleAllVisibleApplications} onBulkStatus={handleBulkItemStatus} onBulkConversion={handleBulkConversion} />}

      {selectedApplication && <ApplicationDrawer application={selectedApplication} onClose={() => setSelectedApplication(null)} onUpdateItem={updateItem} onConvertItem={convertItem} onCopyInvoiceLink={copyInvoiceLink} onResolveReview={resolveApplicationReview} resolvingReview={resolvingReview} convertingItemId={convertingItemId} />}
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
    <section className="grid gap-3 sm:grid-cols-3"><NextCard icon="payments" title="결제 관리" text="신청 상세에서 청구서 생성과 결제 링크 복사를 확인합니다." /><NextCard icon="directions_bus" title="차량 배차" text="셔틀 신청 여부와 승하차 위치를 신청 상세에서 확인합니다." /><NextCard icon="analytics" title="운영 통계" text="모집·승인·미납·대기 요약을 상단 카드로 확인합니다." /></section></div>;
}

function SeasonsView({ seasons, selected, onSelect, onAddClass, onEditSeason, onEditClass, onStatus }: { seasons: Season[]; selected?: Season; onSelect: (id: string) => void; onAddClass: () => void; onEditSeason: (season: Season) => void; onEditClass: (klass: SeasonalClass) => void; onStatus: (id: string, status: SeasonStatus) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><Panel title="시즌 목록" icon="event_note"><div className="space-y-2">{seasons.map((season) => <button type="button" key={season.id} onClick={() => onSelect(season.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === season.id ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)]" : "border-gray-200 dark:border-gray-700"}`}><p className="font-bold">{season.name}</p><p className="mt-1 text-xs text-gray-500">{STATUS_LABEL[season.status]} · {season.classes.length}개 반</p></button>)}{!seasons.length && <Empty text="개설된 시즌이 없습니다." />}</div></Panel>
    <Panel title={selected?.name ?? "시즌을 선택하세요"} icon="view_week" action={selected && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEditSeason(selected)} className="min-h-10 rounded-lg border border-gray-200 px-3 text-sm font-bold dark:border-gray-700">시즌 수정</button><select aria-label="시즌 상태" value={selected.status} onChange={(event) => void onStatus(selected.id, event.target.value as SeasonStatus)} className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-800">{["DRAFT","PUBLISHED","CLOSED","ARCHIVED"].map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}</select><button type="button" onClick={onAddClass} className="min-h-10 rounded-lg bg-[var(--brand-accent)] px-3 text-sm font-black text-[var(--brand-accent-contrast)]">반 추가</button></div>}>
      {selected ? <><div className="mb-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3 dark:bg-gray-800"><p><span className="block text-xs text-gray-500">모집 기간</span>{formatDate(selected.enrollmentStartsAt)} ~ {formatDate(selected.enrollmentEndsAt)}</p><p><span className="block text-xs text-gray-500">운영 기간</span>{formatDate(selected.startsAt)} ~ {formatDate(selected.endsAt)}</p><p><span className="block text-xs text-gray-500">지점</span>{selected.branch || "전체"}</p></div><div className="space-y-3">{selected.classes.map((klass) => { const confirmed = klass.confirmedCount ?? 0; const percent = Math.min(100, klass.capacity ? confirmed / klass.capacity * 100 : 0); return <article key={klass.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{klass.name}</h3>{klass.shuttleAvailable && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">셔틀</span>}</div><p className="mt-1 text-sm text-gray-500">{klass.dayOfWeek} {klass.startTime}~{klass.endTime} · {klass.targetGrade || "전체 학년"} · {klass.instructorName || "담당자 미정"}</p></div><div className="text-right"><p className="font-black">{klass.price.toLocaleString()}원</p><p className="text-xs text-gray-500">확정 {confirmed}/{klass.capacity} · 대기 {klass.waitlistCount ?? 0}</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-full rounded-full bg-[var(--brand-accent)]" style={{ width: `${percent}%` }} /></div></article>; })}{!selected.classes.length && <Empty text="아직 개설된 반이 없습니다. '반 추가'를 눌러 시작하세요." />}</div></> : <Empty text="왼쪽에서 시즌을 선택하세요." />}
      {selected && selected.classes.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">{selected.classes.map((klass) => <button type="button" key={klass.id} onClick={() => onEditClass(klass)} className="min-h-10 rounded-lg border border-gray-200 px-3 text-xs font-bold dark:border-gray-700">{klass.name} 수정</button>)}</div>}
    </Panel></div>;
}

function ApplicationsView({
  applications,
  search,
  status,
  selectedItemIdSet,
  selectedItemCount,
  selectedApplicationCount,
  allVisibleSelected,
  bulkProcessingStatus,
  bulkConverting,
  onSearch,
  onStatus,
  onSelect,
  onToggleApplication,
  onToggleAll,
  onBulkStatus,
  onBulkConversion,
}: {
  applications: Application[];
  search: string;
  status: string;
  selectedItemIdSet: Set<string>;
  selectedItemCount: number;
  selectedApplicationCount: number;
  allVisibleSelected: boolean;
  bulkProcessingStatus: ItemStatus | "";
  bulkConverting: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onSelect: (application: Application) => void;
  onToggleApplication: (application: Application, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onBulkStatus: (status: ItemStatus) => Promise<void>;
  onBulkConversion: () => Promise<void>;
}) {
  const visibleItemCount = applications.reduce((sum, application) => sum + application.items.length, 0);

  return <Panel title="신청 목록" icon="assignment_ind">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1">
        <Icon name="search" className="absolute left-3 top-3 text-xl text-gray-400" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="학생·학부모·전화번호 검색" className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 dark:border-gray-700 dark:bg-gray-800" />
      </label>
      <select aria-label="신청 상태" value={status} onChange={(event) => onStatus(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
        <option value="ALL">전체 상태</option>
        {["PENDING","APPROVED","WAITLISTED","REJECTED","CANCELLED"].map((value) => <option value={value} key={value}>{STATUS_LABEL[value]}</option>)}
      </select>
    </div>

    {selectedItemCount > 0 && (
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-gray-950 dark:text-white">선택한 신청 반 {selectedItemCount}개</p>
          <p className="mt-1 text-xs font-bold text-gray-600 dark:text-gray-300">{selectedApplicationCount}명 학생을 현재 목록에서 처리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {BULK_ITEM_STATUSES.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              disabled={Boolean(bulkProcessingStatus) || bulkConverting}
              onClick={() => void onBulkStatus(nextStatus)}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-900 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {bulkProcessingStatus === nextStatus ? "처리 중" : STATUS_LABEL[nextStatus]}
            </button>
          ))}
          <button
            type="button"
            disabled={Boolean(bulkProcessingStatus) || bulkConverting}
            onClick={() => void onBulkConversion()}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[var(--brand-accent)] px-3 text-sm font-black text-[var(--brand-accent-contrast)] disabled:cursor-wait disabled:opacity-60"
          >
            <Icon name="receipt_long" className="text-lg" />
            {bulkConverting ? "생성 중" : "수강·청구 생성"}
          </button>
        </div>
      </div>
    )}

    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                aria-label="현재 목록 전체 선택"
                checked={allVisibleSelected}
                disabled={visibleItemCount === 0}
                onChange={(event) => onToggleAll(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 accent-[var(--brand-accent)]"
              />
            </th>
            <th className="px-4 py-3">학생</th>
            <th className="px-4 py-3">학부모</th>
            <th className="px-4 py-3">신청 반</th>
            <th className="px-4 py-3">결제</th>
            <th className="px-4 py-3">셔틀</th>
            <th className="px-4 py-3">접수일</th>
            <th className="px-4 py-3"><span className="sr-only">상세</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {applications.map((application) => {
            const itemIds = application.items.map((item) => item.id);
            const selectedCount = itemIds.filter((itemId) => selectedItemIdSet.has(itemId)).length;
            const checked = itemIds.length > 0 && selectedCount === itemIds.length;
            return (
              <tr key={application.id} className={checked ? "bg-[var(--brand-accent-soft)]/60 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}>
                <td className="px-4 py-4 align-top">
                  <input
                    type="checkbox"
                    aria-label={`${application.childName} 신청 선택`}
                    checked={checked}
                    disabled={itemIds.length === 0}
                    onChange={(event) => onToggleApplication(application, event.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 accent-[var(--brand-accent)]"
                  />
                </td>
                <td className="px-4 py-4 align-top">
                  <button type="button" onClick={() => onSelect(application)} className="font-black hover:underline">{application.childName}</button>
                  <p className="text-xs text-gray-500">{application.childGrade} {application.childSchool}</p>
                  {selectedCount > 0 && <p className="mt-1 text-xs font-black text-[var(--brand-accent)]">{selectedCount}/{itemIds.length}개 선택</p>}
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="font-bold">{application.parentName}</p>
                  <a href={`tel:${application.parentPhone}`} className="text-xs text-[var(--brand-accent)] hover:underline">{application.parentPhone}</a>
                </td>
                <td className="px-4 py-4 align-top">
                  <p>{application.items.length}개 반</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {application.items.slice(0,2).map((item) => <span key={item.id} className={badge(item.status)}>{STATUS_LABEL[item.status]}</span>)}
                    {application.items.length > 2 && <span className="inline-flex min-h-7 items-center rounded-full bg-gray-100 px-2.5 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">+{application.items.length - 2}</span>}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className={badge(application.paymentStatus)}>{STATUS_LABEL[application.paymentStatus || ""] ?? application.paymentStatus ?? "청구 전"}</span>
                  <p className="mt-1 text-xs">{(application.totalAmount ?? 0).toLocaleString()}원</p>
                </td>
                <td className="px-4 py-4 align-top">{application.shuttleNeeded ? <span className={badge(application.shuttleStatus || "UNASSIGNED")}>{STATUS_LABEL[application.shuttleStatus || "UNASSIGNED"]}</span> : "미이용"}</td>
                <td className="px-4 py-4 align-top text-gray-500">{formatDate(application.createdAt)}</td>
                <td className="px-4 py-4 align-top"><button type="button" onClick={() => onSelect(application)} className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 px-3 font-bold dark:border-gray-700">상세</button></td>
              </tr>
            );
          })}
          {!applications.length && <tr><td colSpan={8}><Empty text="조건에 맞는 신청이 없습니다." /></td></tr>}
        </tbody>
      </table>
    </div>
  </Panel>;
}

function ApplicationDrawer({
  application,
  onClose,
  onUpdateItem,
  onConvertItem,
  onCopyInvoiceLink,
  onResolveReview,
  resolvingReview,
  convertingItemId,
}: {
  application: Application;
  onClose: () => void;
  onUpdateItem: (id: string, status: ItemStatus) => Promise<void>;
  onConvertItem: (id: string) => Promise<void>;
  onCopyInvoiceLink: (item: ApplicationItem) => Promise<void>;
  onResolveReview: (applicationId: string, reviewNote: string) => Promise<void>;
  resolvingReview: boolean;
  convertingItemId: string;
}) {
  const totalAmount = application.totalAmount ?? application.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const parentPhoneHref = application.parentPhone ? `tel:${application.parentPhone}` : undefined;
  const parentSmsHref = application.parentPhone ? `sms:${application.parentPhone}` : undefined;

  return <AdminModal onClose={onClose} titleId="application-title" panelClassName="h-full max-w-2xl rounded-none sm:ml-auto sm:mr-0 sm:rounded-l-2xl sm:rounded-r-none">
    <aside className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7">
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
        <button type="button" onClick={onClose} aria-label="닫기" data-admin-modal-initial-focus className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><Icon name="close" /></button>
      </header>

      <ApplicationReviewSummary application={application} onResolveReview={onResolveReview} resolving={resolvingReview} />

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
          {application.items.map((item) => <ApplicationItemCard key={item.id} item={item} onUpdateItem={onUpdateItem} onConvertItem={onConvertItem} onCopyInvoiceLink={onCopyInvoiceLink} converting={convertingItemId === item.id} />)}
        </div>
      </section>

      {application.memo && <section className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="text-sm font-black text-gray-950 dark:text-white">요청사항</h3><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{application.memo}</p></section>}
      {application.processedNote && <section className="mt-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="text-sm font-black text-gray-950 dark:text-white">처리 메모</h3><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{application.processedNote}</p></section>}
    </aside>
  </AdminModal>;
}

function ApplicationReviewSummary({ application, onResolveReview, resolving }: { application: Application; onResolveReview: (applicationId: string, reviewNote: string) => Promise<void>; resolving: boolean }) {
  const importedLabel = application.imported ? `가져온 신청${application.importSource ? ` · ${application.importSource}` : ""}` : "홈페이지 신청";
  const weekdays = application.selectedWeekdays?.length ? application.selectedWeekdays.join(" · ") : "요일 미확인";
  const needsReview = application.reviewReasons ?? [];
  const [reviewNote, setReviewNote] = useState("");
  return <section aria-label="운영 확인 정보" className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--brand-accent-soft)] px-2.5 text-xs font-black text-[var(--brand-accent)]">{applicantTypeLabel(application.applicantType)} 회원</span>
      <span className="inline-flex min-h-7 items-center rounded-full bg-gray-100 px-2.5 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"><Icon name={application.imported ? "upload_file" : "language"} className="mr-1 text-base" />{importedLabel}</span>
      <span className={badge(application.paymentStatus)}>{paymentReviewLabel(application.paymentStatus)}</span>
    </div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Info label="선택 요일">{weekdays}</Info><Info label="원본 가져오기">{application.imported ? "완료" : "해당 없음"}</Info></dl>
    {needsReview.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"><p className="flex items-center gap-1 text-sm font-black"><Icon name="error" className="text-lg" />확인 필요</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{needsReview.map((reason) => <li key={reason}>{reason}</li>)}</ul><label className="mt-3 block text-xs font-black">검토 메모 (필수)<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={2} placeholder="확인한 내용과 처리 근거를 입력하세요" className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-2 font-normal text-gray-950 dark:border-amber-700 dark:bg-gray-900 dark:text-white" /></label><div className="mt-2 flex justify-end"><button type="button" disabled={resolving || !reviewNote.trim()} onClick={() => void onResolveReview(application.id, reviewNote.trim())} className="min-h-9 rounded-lg bg-amber-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-100 dark:text-amber-950">{resolving ? "처리 중…" : "검토 완료"}</button></div></div>}
  </section>;
}

function ApplicationItemCard({ item, onUpdateItem, onConvertItem, onCopyInvoiceLink, converting }: { item: ApplicationItem; onUpdateItem: (id: string, status: ItemStatus) => Promise<void>; onConvertItem: (id: string) => Promise<void>; onCopyInvoiceLink: (item: ApplicationItem) => Promise<void>; converting: boolean }) {
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
    <ConversionReadinessBox item={item} onConvertItem={onConvertItem} converting={converting} />
    {item.invoice && <InvoiceActionBox item={item} onCopyInvoiceLink={onCopyInvoiceLink} />}
    {item.shuttleRequest && <ShuttleRequestBox request={item.shuttleRequest} />}
  </article>;
}

function ConversionReadinessBox({ item, onConvertItem, converting }: { item: ApplicationItem; onConvertItem: (id: string) => Promise<void>; converting: boolean }) {
  const approved = item.status === "APPROVED";
  const hasClass = Boolean(item.linkedClassId);
  const hasEnrollment = Boolean(item.enrollmentId);
  const hasPayment = Boolean(item.paymentId);
  const readyToConvert = approved && hasClass && (!hasEnrollment || !hasPayment);
  let title = "전환 준비됨";
  let helper = "다음 단계에서 수강 등록과 청구 생성을 실행할 수 있습니다.";
  let tone = "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100";

  if (hasEnrollment && hasPayment) {
    title = "수강·청구 연결 완료";
    helper = "수강 이력과 청구가 모두 이 신청 항목에 연결되어 있습니다.";
  } else if (!approved) {
    title = "승인 후 전환 가능";
    helper = "먼저 신청 항목을 승인하면 수강 등록과 청구 생성 대상으로 검토할 수 있습니다.";
    tone = "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
  } else if (!hasClass) {
    title = "정규 반 연결 필요";
    helper = "시즌·반 설정에서 이 특강 반을 기존 반과 연결해야 자동 전환할 수 있습니다.";
    tone = "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100";
  } else if (!hasEnrollment && hasPayment) {
    title = "수강 등록 연결 필요";
    helper = "청구는 연결되어 있지만 수강 이력이 아직 연결되지 않았습니다.";
    tone = "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100";
  } else if (hasEnrollment && !hasPayment) {
    title = "청구 생성 필요";
    helper = "수강 이력은 연결되어 있고 청구 생성만 남았습니다.";
    tone = "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100";
  }

  return <div className={`mt-4 rounded-xl border p-3 text-sm ${tone}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-xs opacity-80">{helper}</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-start gap-1 sm:justify-end">
        <MiniState active={hasClass} label="반 연결" />
        <MiniState active={hasEnrollment} label="수강" />
        <MiniState active={hasPayment} label="청구" />
        {readyToConvert && (
          <button
            type="button"
            disabled={converting}
            onClick={() => void onConvertItem(item.id)}
            className="ml-0 min-h-8 rounded-full bg-[var(--brand-accent)] px-3 text-[11px] font-black text-[var(--brand-accent-contrast)] disabled:opacity-60 sm:ml-2"
          >
            {converting ? "생성 중" : "수강·청구 생성"}
          </button>
        )}
      </div>
    </div>
  </div>;
}

function MiniState({ active, label }: { active: boolean; label: string }) {
  return <span className={`rounded-full px-2 py-1 text-[11px] font-black ${active ? "bg-white text-emerald-700 dark:bg-emerald-100 dark:text-emerald-900" : "bg-white/60 text-gray-500 dark:bg-gray-900/50 dark:text-gray-300"}`}>{label}</span>;
}

function InvoiceActionBox({ item, onCopyInvoiceLink }: { item: ApplicationItem; onCopyInvoiceLink: (item: ApplicationItem) => Promise<void> }) {
  const href = getItemInvoiceHref(item);
  return <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-black text-gray-950 dark:text-white">청구서</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {item.invoice?.invoiceNo || "청구번호 준비됨"} · {STATUS_LABEL[item.invoice?.status || ""] ?? item.invoice?.status ?? "발행"}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {(item.invoice?.amount ?? item.amount ?? 0).toLocaleString()}원 · 납부기한 {formatDate(item.invoice?.dueDate)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {href && <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] dark:border-gray-700 dark:text-gray-200">청구서 열기</a>}
        <button type="button" onClick={() => void onCopyInvoiceLink(item)} className="inline-flex min-h-10 items-center rounded-xl bg-[var(--brand-accent)] px-3 text-xs font-black text-[var(--brand-accent-contrast)]">링크 복사</button>
      </div>
    </div>
  </div>;
}

type ShuttlePoint = {
  label: string;
  location?: string | null;
  address?: string | null;
  roadAddress?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  placeId?: string | null;
  source?: string | null;
  accuracyMeters?: number | string | null;
  confirmedAt?: string | null;
};

function shuttlePoint(request: ShuttleRequest, kind: ShuttlePointKind): ShuttlePoint {
  if (kind === "pickup") {
    return {
      label: "탑승 위치",
      location: request.pickupLocation,
      address: request.pickupAddress,
      roadAddress: request.pickupRoadAddress,
      latitude: request.pickupLatitude,
      longitude: request.pickupLongitude,
      placeId: request.pickupPlaceId,
      source: request.pickupLocationSource,
      accuracyMeters: request.pickupAccuracyMeters,
      confirmedAt: request.pickupConfirmedAt,
    };
  }
  return {
    label: "하차 위치",
    location: request.dropoffLocation,
    address: request.dropoffAddress,
    roadAddress: request.dropoffRoadAddress,
    latitude: request.dropoffLatitude,
    longitude: request.dropoffLongitude,
    placeId: request.dropoffPlaceId,
    source: request.dropoffLocationSource,
    accuracyMeters: request.dropoffAccuracyMeters,
    confirmedAt: request.dropoffConfirmedAt,
  };
}

function finiteCoordinate(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ShuttleLocationCard({ point }: { point: ShuttlePoint }) {
  const latitude = finiteCoordinate(point.latitude);
  const longitude = finiteCoordinate(point.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const displayAddress = point.roadAddress || point.address || point.location || "위치 미입력";
  const searchQuery = displayAddress === "위치 미입력" ? "" : displayAddress;
  const encodedLabel = encodeURIComponent(`${point.label} ${displayAddress}`);
  const kakaoHref = hasCoordinates
    ? `https://map.kakao.com/link/map/${encodedLabel},${latitude},${longitude}`
    : searchQuery ? `https://map.kakao.com/?q=${encodeURIComponent(searchQuery)}` : null;
  const naverHref = hasCoordinates
    ? `https://map.naver.com/p?c=${longitude},${latitude},15,0,0,0,dh`
    : searchQuery ? `https://map.naver.com/p/search/${encodeURIComponent(searchQuery)}` : null;
  const accuracy = finiteCoordinate(point.accuracyMeters);

  return <article className="min-w-0 rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-gray-900">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name={point.label === "탑승 위치" ? "trip_origin" : "location_on"} className="shrink-0 text-xl text-blue-700 dark:text-blue-300" />
        <h5 className="font-black text-gray-950 dark:text-white">{point.label}</h5>
      </div>
      {hasCoordinates ? (
        <span className={badge("UNASSIGNED")}>지도 핀 제출 · 관리자 확인 필요</span>
      ) : (
        <span className={badge("UNASSIGNED")}>텍스트 신청 · 위치 확인 필요</span>
      )}
    </div>

    <p className="mt-3 break-words text-sm font-bold text-gray-900 dark:text-white">{displayAddress}</p>
    {point.location && point.location !== displayAddress && <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-300">상세 설명: {point.location}</p>}
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <Info label="좌표">{hasCoordinates ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "좌표 없음"}</Info>
      <Info label="제출 시각">{point.confirmedAt ? formatDateTime(point.confirmedAt) : "기록 없음"}</Info>
      {(point.source || point.placeId) && <Info label="지도 정보">{[point.source, point.placeId].filter(Boolean).join(" · ")}</Info>}
      {accuracy !== null && <Info label="위치 정확도">약 {Math.round(accuracy)}m</Info>}
    </dl>

    {(kakaoHref || naverHref) && <div className="mt-3 grid grid-cols-2 gap-2">
      {kakaoHref && <a href={kakaoHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-white px-2 text-xs font-black text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-blue-950/40"><Icon name="map" className="text-base" />카카오맵</a>}
      {naverHref && <a href={naverHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-xs font-black text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"><Icon name="map" className="text-base" />네이버 지도</a>}
    </div>}
  </article>;
}

function ShuttleRequestBox({ request }: { request: ShuttleRequest }) {
  return <div className="mt-4 min-w-0 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-black text-blue-900 dark:text-blue-100">셔틀 요청</h4>
      <span className={badge(request.status || "REQUESTED")}>{STATUS_LABEL[request.status || "REQUESTED"]}</span>
    </div>
    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
      <ShuttleLocationCard point={shuttlePoint(request, "pickup")} />
      <ShuttleLocationCard point={shuttlePoint(request, "dropoff")} />
    </div>
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      <Info label="희망 시간">{request.pickupTime || "미입력"}</Info>
      <Info label="배정">{request.assignedRouteId || request.assignedStopId ? [request.assignedRouteId, request.assignedStopId].filter(Boolean).join(" · ") : "미배정"}</Info>
      {request.locationConsentVersion && <Info label="위치정보 동의">버전 {request.locationConsentVersion}</Info>}
    </dl>
    {request.note && <p className="mt-3 whitespace-pre-wrap break-words text-xs text-blue-900 dark:text-blue-100">{request.note}</p>}
  </div>;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <p><span className="block text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span><b className="font-bold text-gray-900 dark:text-white">{children}</b></p>;
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function dateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SeasonForm({ initial, onClose, onSubmit }: { initial?: Season | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <FormModal title="새 방학특강 시즌" onClose={onClose} onSubmit={onSubmit} fields={[{name:"title",label:"시즌명",placeholder:"예: 2026 여름방학 특강",required:true,defaultValue:initial?.name},{name:"slug",label:"홈페이지 주소",placeholder:"예: 2026-summer",required:true,defaultValue:initial?.slug},{name:"applicationOpensAt",label:"모집 시작일",type:"date",required:true,defaultValue:dateInputValue(initial?.enrollmentStartsAt)},{name:"applicationClosesAt",label:"모집 종료일",type:"date",required:true,defaultValue:dateInputValue(initial?.enrollmentEndsAt)},{name:"startsAt",label:"수업 시작일",type:"date",required:true,defaultValue:dateInputValue(initial?.startsAt)},{name:"endsAt",label:"수업 종료일",type:"date",required:true,defaultValue:dateInputValue(initial?.endsAt)}]} />;
}

function ClassForm({ seasonId, initial, onClose, onSubmit }: { seasonId: string; initial?: SeasonalClass | null; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sessionDates, setSessionDates] = useState(() => initial?.sessionDates?.length
    ? initial.sessionDates.map((row) => ({ id: row.id, startsAt: dateTimeInputValue(row.startsAt), endsAt: dateTimeInputValue(row.endsAt), location: row.location ?? "", note: row.note ?? "" }))
    : [{ startsAt: "", endsAt: "", location: initial?.location ?? "", note: "" }]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const capacity = String(payload.capacity ?? "").trim();
    const newApplicantPrice = String(payload.newApplicantPrice ?? "").trim();
    const existingApplicantPrice = String(payload.existingApplicantPrice ?? "").trim();
    try {
      await onSubmit({
        ...payload,
        seasonId,
        capacity: capacity ? Number(capacity) : null,
        price: Number(payload.price),
        newApplicantPrice: newApplicantPrice ? Number(newApplicantPrice) : null,
        existingApplicantPrice: existingApplicantPrice ? Number(existingApplicantPrice) : null,
        shuttleAvailable: payload.shuttleAvailable === "on",
        sessionDates: sessionDates.map((row) => ({
          ...row,
          startsAt: seoulDateTimeToIso(row.startsAt),
          endsAt: seoulDateTimeToIso(row.endsAt),
        })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
      setPending(false);
    }
  }

  const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal text-gray-950 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
  return <AdminModal onClose={() => { if (!pending) onClose(); }} titleId="seasonal-class-modal-title"><form onSubmit={submit} className="w-full max-w-3xl p-6"><header className="flex items-center justify-between"><div><h2 id="seasonal-class-modal-title" className="text-xl font-black">{initial ? "특강 반 수정" : "특강 반 추가"}</h2><p className="mt-1 text-xs text-gray-500">반 기본 정보와 실제 수업 회차를 함께 저장합니다.</p></div><button type="button" onClick={onClose} disabled={pending} aria-label="닫기"><Icon name="close" /></button></header>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <ClassInput name="code" label="반 코드" required defaultValue={initial?.code} placeholder="예: MON-1" />
      <ClassInput name="title" label="반 이름" required defaultValue={initial?.name} placeholder="예: 초등 고학년 1교시" />
      <ClassInput name="targetGrades" label="대상" required defaultValue={initial?.targetGrades ?? initial?.targetGrade} placeholder="예: 초등 4~6학년" />
      <ClassInput name="location" label="기본 수업 장소" defaultValue={initial?.location} placeholder="예: 다산점" />
      <ClassInput name="capacity" label="정원 (미확정 가능)" type="number" defaultValue={initial?.capacity} />
      <ClassInput name="price" label="기본 수강료" type="number" required defaultValue={initial?.price} />
      <ClassInput name="newApplicantPrice" label="신규 회원 수강료" type="number" defaultValue={initial?.newApplicantPrice} />
      <ClassInput name="existingApplicantPrice" label="기존 회원 수강료" type="number" defaultValue={initial?.existingApplicantPrice} />
      <ClassInput name="instructorName" label="담당 선생님" defaultValue={initial?.instructorName} placeholder="미정이면 비워두세요" />
      <ClassInput name="instructorId" label="담당 강사 ID" defaultValue={initial?.instructorId} placeholder="강사 계정 ID (선택)" />
      <ClassInput name="linkedProgramId" label="연결 프로그램 ID" defaultValue={initial?.linkedProgramId} placeholder="기존 프로그램 ID (선택)" />
      <ClassInput name="linkedClassId" label="연결 정규 반 ID" defaultValue={initial?.linkedClassId} placeholder="수강·출석에 연결할 반 ID" />
      <label className="text-sm font-bold text-gray-700 dark:text-gray-200">공개 상태<select name="status" defaultValue={initial?.status ?? "DRAFT"} className={inputClass}><option value="DRAFT">작성 중</option><option value="OPEN">모집 중</option><option value="CLOSED">모집 마감</option><option value="CANCELLED">취소</option></select></label>
      <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-gray-200 px-3 text-sm font-bold dark:border-gray-700"><input name="shuttleAvailable" type="checkbox" defaultChecked={initial?.shuttleAvailable} className="size-5" />셔틀 이용 가능</label>
    </div>
    <section className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800"><div className="flex items-center justify-between"><div><h3 className="font-black">전체 수업 일정</h3><p className="text-xs text-gray-500">학생에게 안내할 모든 회차를 입력하세요.</p></div><button type="button" onClick={() => setSessionDates((rows) => [...rows, { startsAt: "", endsAt: "", location: initial?.location ?? "", note: "" }])} className="min-h-10 rounded-lg border border-gray-200 px-3 text-sm font-bold dark:border-gray-700">회차 추가</button></div>
      <div className="mt-3 space-y-3">{sessionDates.map((row, index) => <div key={index} className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 dark:bg-gray-800"><label className="text-xs font-bold">{index + 1}회 시작<input required type="datetime-local" value={row.startsAt} onChange={(event) => setSessionDates((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, startsAt: event.target.value } : item))} className={inputClass} /></label><label className="text-xs font-bold">{index + 1}회 종료<input required type="datetime-local" value={row.endsAt} onChange={(event) => setSessionDates((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, endsAt: event.target.value } : item))} className={inputClass} /></label><label className="text-xs font-bold">장소<input value={row.location} onChange={(event) => setSessionDates((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, location: event.target.value } : item))} className={inputClass} /></label><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-bold">메모<input value={row.note} onChange={(event) => setSessionDates((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, note: event.target.value } : item))} className={inputClass} /></label>{sessionDates.length > 1 && <button type="button" aria-label={`${index + 1}회 삭제`} onClick={() => setSessionDates((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="mb-0 min-h-11 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700">삭제</button>}</div></div>)}</div>
    </section>
    <footer className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-gray-200 px-4 font-bold disabled:opacity-60 dark:border-gray-700">취소</button><button disabled={pending} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-60">{pending ? "저장 중…" : "저장"}</button></footer>
  </form></AdminModal>;
}

function ClassInput({ name, label, type = "text", placeholder, required, defaultValue }: Field) {
  return <label className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}{required && <span className="text-red-500"> *</span>}<input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} min={type === "number" ? 0 : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal text-gray-950 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>;
}

type Field = { name: string; label: string; type?: string; placeholder?: string; required?: boolean; defaultValue?: string | number | null };
function FormModal({ title, helper, fields, onClose, onSubmit }: { title: string; helper?: string; fields: Field[]; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries()); try { await onSubmit(payload); } catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다."); setPending(false); } }
  const titleId = "seasonal-form-modal-title";
  return <AdminModal onClose={() => { if (!pending) onClose(); }} titleId={titleId}><form onSubmit={submit} className="w-full p-6"><header className="flex items-center justify-between"><h2 id={titleId} className="text-xl font-black">{title}</h2><button type="button" onClick={onClose} disabled={pending} aria-label="닫기"><Icon name="close" /></button></header>{helper && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{helper}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field, index) => <label key={field.name} className="text-sm font-bold text-gray-700 dark:text-gray-200">{field.label}{field.required && <span className="text-red-500"> *</span>}<input name={field.name} type={field.type || "text"} required={field.required} placeholder={field.placeholder} defaultValue={field.defaultValue ?? ""} min={field.type === "number" ? 0 : undefined} data-admin-modal-initial-focus={index === 0 ? "true" : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal text-gray-950 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></label>)}</div><footer className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-xl border border-gray-200 px-4 font-bold disabled:opacity-60 dark:border-gray-700">취소</button><button disabled={pending} className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-black text-[var(--brand-accent-contrast)] disabled:opacity-60">{pending ? "저장 중…" : "저장"}</button></footer></form></AdminModal>;
}

function Panel({ title, icon, action, children }: { title: string; icon: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"><header className="flex min-w-0 flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center dark:border-gray-800"><h2 className="flex min-w-0 items-center gap-2 break-words font-black"><Icon name={icon} className="text-[var(--brand-accent)]" />{title}</h2>{action}</header><div className="min-w-0 max-w-full p-5">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center"><Icon name="inbox" className="text-4xl text-gray-300" /><p className="mt-2 text-sm text-gray-500">{text}</p></div>; }
function NextCard({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900"><Icon name={icon} className="text-2xl text-gray-400" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-gray-500">{text}</p><span className="mt-3 inline-block text-xs font-bold text-[var(--brand-accent)]">운영 상태 확인</span></div>; }
function Loading() { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>; }
