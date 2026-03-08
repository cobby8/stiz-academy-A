import { getAnnualEvents, createAnnualEvent, deleteAnnualEvent } from "@/app/actions/admin";
import DeleteEventButton from "./DeleteEventButton";

const CATEGORIES = ["일반", "대회", "방학", "특별행사", "정기행사"];

const CATEGORY_BADGE: Record<string, string> = {
    대회: "bg-red-100 text-red-700",
    방학: "bg-yellow-100 text-yellow-700",
    특별행사: "bg-purple-100 text-purple-700",
    정기행사: "bg-blue-100 text-blue-700",
    일반: "bg-gray-100 text-gray-600",
};

function formatDate(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function AdminAnnualEventsPage() {
    let events: any[] = [];
    let fetchError = false;
    try {
        events = await getAnnualEvents() as any[];
    } catch (e) {
        fetchError = true;
    }

    async function addEvent(formData: FormData) {
        "use server";
        const title = formData.get("title") as string;
        const date = formData.get("date") as string;
        const endDate = formData.get("endDate") as string;
        const description = formData.get("description") as string;
        const category = formData.get("category") as string;
        if (!title || !date) return;
        try {
            await createAnnualEvent({ title, date, endDate: endDate || undefined, description, category });
        } catch (e) {
            console.error("addEvent failed:", e);
        }
    }

    async function removeEvent(formData: FormData) {
        "use server";
        const id = formData.get("id") as string;
        try {
            if (id) await deleteAnnualEvent(id);
        } catch (e) {
            console.error("removeEvent failed:", e);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">연간일정표 관리</h1>
                <p className="text-gray-500">대회, 방학, 행사 일정을 등록하고 관리합니다. 홈페이지 '연간일정표' 페이지에 자동으로 반영됩니다.</p>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 text-sm">
                    데이터베이스 스키마 동기화가 필요합니다. 터미널에서 <code className="bg-red-100 px-1 py-0.5 rounded">npx prisma db push</code>를 실행해 주세요.
                </div>
            )}

            {/* Add Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-5">새 일정 등록</h2>
                <form action={addEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">일정 제목 *</label>
                        <input
                            name="title"
                            type="text"
                            placeholder="예: 2026 경기도 유소년 농구대회"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
                        <input
                            name="date"
                            type="date"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">종료일 (선택)</label>
                        <input
                            name="endDate"
                            type="date"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
                        <select
                            name="category"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                        >
                            {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                        <input
                            name="description"
                            type="text"
                            placeholder="예: 장소: 경기 체육관 / 참가팀 대상"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end pt-2">
                        <button
                            type="submit"
                            className="bg-brand-navy-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition shadow-sm text-sm"
                        >
                            일정 등록하기
                        </button>
                    </div>
                </form>
            </div>

            {/* Events List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">등록된 일정 목록</h2>
                    <span className="text-sm text-gray-500">{events.length}개</span>
                </div>
                <ul className="divide-y divide-gray-100">
                    {events.length === 0 && !fetchError && (
                        <li className="p-10 text-center text-gray-400">
                            <div className="text-4xl mb-3">📅</div>
                            <p>등록된 일정이 없습니다.</p>
                        </li>
                    )}
                    {events.map((event) => (
                        <li key={event.id} className="p-5 hover:bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${CATEGORY_BADGE[event.category] || CATEGORY_BADGE["일반"]}`}>
                                        {event.category || "일반"}
                                    </span>
                                    <h3 className="font-bold text-gray-900">{event.title}</h3>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {formatDate(event.date)}
                                    {event.endDate && ` ~ ${formatDate(event.endDate)}`}
                                </p>
                                {event.description && (
                                    <p className="text-sm text-gray-400 mt-0.5">{event.description}</p>
                                )}
                            </div>
                            <DeleteEventButton action={removeEvent} eventId={event.id} />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
