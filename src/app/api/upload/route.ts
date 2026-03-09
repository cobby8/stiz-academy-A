import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No file received." }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filename = `${Date.now()}.${ext}`;
        const path = `coaches/${filename}`;

        const supabase = createAdminClient();
        const { data, error } = await supabase.storage
            .from("uploads")
            .upload(path, buffer, {
                contentType: file.type || "image/jpeg",
                upsert: false,
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(data.path);
        return NextResponse.json({ url: urlData.publicUrl });
    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: e.message || "Failed to upload file." }, { status: 500 });
    }
}
