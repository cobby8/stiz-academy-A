"use client";

import { useFormStatus } from "react-dom";
import React from "react";

export default function ConfirmSubmitButton({
    children,
    confirmMessage,
    className,
    formAction
}: {
    children: React.ReactNode;
    confirmMessage: string;
    className?: string;
    formAction?: (payload: FormData) => void;
}) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            formAction={formAction}
            disabled={pending}
            className={className}
            onClick={(e) => {
                if (!confirm(confirmMessage)) {
                    e.preventDefault();
                }
            }}
        >
            {pending ? "처리 중..." : children}
        </button>
    );
}
