import { getPrograms, getClasses, createClass, deleteClass } from "@/app/actions/admin";

export default async function AdminClassesPage() {
    let programs: any[] = [];
    let classes: any[] = [];
    let fetchError = false;

    try {
        programs = await getPrograms();
        classes = await getClasses();
    } catch (e) {
        console.error("Error fetching classes data:", e);
        fetchError = true;
    }

    async function addClass(formData: FormData) {
        "use server";
        const programId = formData.get("programId") as string;
        const name = formData.get("name") as string;
        const dayOfWeek = formData.get("dayOfWeek") as string;
        const startTime = formData.get("startTime") as string;
        const endTime = formData.get("endTime") as string;
        const location = formData.get("location") as string;
        const capacity = parseInt(formData.get("capacity") as string) || 0;

        if (!programId || !name || !dayOfWeek) return;

        try {
            await createClass({ programId, name, dayOfWeek, startTime, endTime, location, capacity });
        } catch (e) {
            console.error("addClass failed:", e);
        }
    }

    async function removeClass(formData: FormData) {
        "use server";
        const id = formData.get("id") as string;
        try {
            if (id) await deleteClass(id);
        } catch (e) {
            console.error("removeClass failed:", e);
        }
    }

    const days = [
        { value: "Mon", label: "월요일" },
        { value: "Tue", label: "화요일" },
        { value: "Wed", label: "수요일" },
        { value: "Thu", label: "목요일" },
        { value: "Fri", label: "금요일" },
        { value: "Sat", label: "토요일" },
        { value: "Sun", label: "일요일" }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">클래스(시간표) 관리</h1>
                <p className="text-gray-500">각 프로그램별 요일과 시간에 맞는 실제 클래스를 개설합니다.</p>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200">
                    데이터베이스 연결에 문제가 발생했습니다. (Prisma 클라이언트 동기화 필요)
                </div>
            )}

            {/* Add Class Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">새 클래스 개설</h2>
                {programs.length === 0 && !fetchError ? (
                    <div className="text-amber-600 bg-amber-50 p-4 rounded-md">
                        먼저 [프로그램 관리] 메뉴에서 프로그램을 하나 이상 등록해야 클래스를 개설할 수 있습니다.
                    </div>
                ) : (
                    <form action={addClass} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">소속 프로그램 *</label>
                            <select name="programId" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-white" required>
                                <option value="">선택하세요</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">반 이름 *</label>
                            <input name="name" type="text" placeholder="예: 초등 저학년 A반" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">요일 *</label>
                            <select name="dayOfWeek" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 bg-white" required>
                                <option value="">선택하세요</option>
                                {days.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                            <input name="startTime" type="time" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                            <input name="endTime" type="time" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">정원 (명) *</label>
                            <input name="capacity" type="number" defaultValue="10" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" required />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">장소(코트)</label>
                            <input name="location" type="text" placeholder="예: A코트, 메인구장" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" />
                        </div>
                        <div className="flex items-end justify-end">
                            <button type="submit" className="bg-brand-navy-900 text-white px-4 py-2 rounded-md font-bold hover:bg-gray-800 transition shadow-sm w-full md:w-auto">
                                개설하기
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Class List by Day */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 p-6 border-b border-gray-100 bg-gray-50/50">개설된 전체 시간표</h2>
                <div className="p-0">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요일/시간</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">클래스명</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">참조 프로그램</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">장소/정원</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {classes.length === 0 && !fetchError && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">개설된 클래스가 없습니다.</td>
                                    </tr>
                                )}
                                {/* Normally we'd sort by day then time, but currently just displaying sequentially */}
                                {classes.map(cls => (
                                    <tr key={cls.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-brand-orange-500">
                                                {days.find(d => d.value === cls.dayOfWeek)?.label || cls.dayOfWeek}
                                            </div>
                                            <div className="text-sm text-gray-500">{cls.startTime || '-'} ~ {cls.endTime || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{cls.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">{cls.program?.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div>{cls.location || '미지정'}</div>
                                            <div>정원: {cls.capacity}명</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <form action={removeClass}>
                                                <input type="hidden" name="id" value={cls.id} />
                                                <button type="submit" formAction={async (formData) => { "use server"; await removeClass(formData); }} className="text-red-500 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition">
                                                    삭제
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
