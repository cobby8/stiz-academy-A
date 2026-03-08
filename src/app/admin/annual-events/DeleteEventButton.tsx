"use client";

interface DeleteEventButtonProps {
    action: (formData: FormData) => Promise<void>;
    eventId: string;
}

export default function DeleteEventButton({ action, eventId }: DeleteEventButtonProps) {
    return (
        <form action={action} className="shrink-0">
            <input type="hidden" name="id" value={eventId} />
            <button
                type="submit"
                className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition border border-red-200 hover:border-red-300"
                onClick={(e) => {
                    if (!confirm("이 일정을 삭제하시겠습니까?")) e.preventDefault();
                }}
            >
                삭제
            </button>
        </form>
    );
}
