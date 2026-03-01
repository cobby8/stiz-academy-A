import { getPrograms, createProgram, deleteProgram } from "@/app/actions/admin";
import { revalidatePath } from "next/cache";

export default async function AdminProgramsPage() {
    // Try to fetch programs, but handle potential schema not synced error gracefully in dev
    let programs: any[] = [];
    let fetchError = false;
    try {
        programs = await getPrograms();
    } catch (e) {
        console.error("Error fetching programs:", e);
        fetchError = true;
    }

    async function addProgram(formData: FormData) {
        "use server";
        const name = formData.get("name") as string;
        const targetAge = formData.get("targetAge") as string;
        const frequency = formData.get("frequency") as string;
        const description = formData.get("description") as string;
        const price = parseInt(formData.get("price") as string) || 0;

        if (!name) return;

        await createProgram({ name, targetAge, frequency, description, price });
    }

    async function removeProgram(formData: FormData) {
        "use server";
        const id = formData.get("id") as string;
        if (id) await deleteProgram(id);
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">프로그램(커리큘럼) 관리</h1>
                <p className="text-gray-500">학원에서 운영하는 교육 프로그램을 등록하고 관리합니다.</p>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200">
                    데이터베이스 연결 또는 스키마 동기화에 오류가 있습니다. (npx prisma db push 실행 필요)
                </div>
            )}

            {/* Add Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">새 프로그램 등록</h2>
                <form action={addProgram} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">프로그램명 *</label>
                        <input name="name" type="text" placeholder="예: 정규 클래스 (취미/기초)" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">대상 연령</label>
                        <input name="targetAge" type="text" placeholder="예: 초등/중등" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">수업 빈도 (요약)</label>
                        <input name="frequency" type="text" placeholder="예: 주 1회/2회" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">기본 수강료 (월)</label>
                        <input name="price" type="number" placeholder="예: 150000" className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500" required />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">프로그램 설명</label>
                        <textarea name="description" rows={2} placeholder="기초 체력과 기본기를 다지는 클래스입니다." className="w-full border border-gray-300 rounded-md p-2 focus:ring-brand-orange-500 focus:border-brand-orange-500"></textarea>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="bg-brand-navy-900 text-white px-4 py-2 rounded-md font-bold hover:bg-gray-800 transition shadow-sm">
                            저장하기
                        </button>
                    </div>
                </form>
            </div>

            {/* Program List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-bold text-gray-900 p-6 border-b border-gray-100 bg-gray-50/50">등록된 프로그램 목록</h2>
                <ul className="divide-y divide-gray-100">
                    {programs.length === 0 && !fetchError && (
                        <li className="p-8 text-center text-gray-500">등록된 프로그램이 없습니다.</li>
                    )}
                    {programs.map((program) => (
                        <li key={program.id} className="p-6 hover:bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">{program.name}</h3>
                                <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                    {program.targetAge && <span><span className="font-medium text-gray-400">대상:</span> {program.targetAge}</span>}
                                    {program.frequency && <span><span className="font-medium text-gray-400">빈도:</span> {program.frequency}</span>}
                                    <span><span className="font-medium text-gray-400">수강료:</span> {program.price.toLocaleString()}원</span>
                                </div>
                                {program.description && <p className="text-sm text-gray-500 mt-2">{program.description}</p>}
                            </div>

                            <div className="flex shrink-0">
                                <form action={removeProgram}>
                                    <input type="hidden" name="id" value={program.id} />
                                    <button type="submit" className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-medium transition"
                                        formAction={async (formData) => { "use server"; await removeProgram(formData); }}>
                                        삭제
                                    </button>
                                </form>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
