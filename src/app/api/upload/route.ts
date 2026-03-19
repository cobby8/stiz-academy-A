import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

async function trySupabaseUpload(buffer: Buffer, folder: string, filename: string, contentType: string): Promise<string | null> {
    try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const BUCKET = "uploads";

        // Auto-create bucket if it doesn't exist
        await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

        const path = `${folder}/${filename}`;
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, { contentType, upsert: false });

        if (error) {
            console.warn("[upload] Supabase error:", error.message);
            return null;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
        return urlData.publicUrl;
    } catch (e: any) {
        console.warn("[upload] Supabase unavailable:", e.message);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No file received." }, { status: 400 });

        // folder: "coaches" | "gallery" | "notices" (default: "coaches" for backward compat)
        const folder = (formData.get("folder") as string) || "coaches";

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // Try Supabase Storage first
        const supabaseUrl = await trySupabaseUpload(buffer, folder, filename, file.type || "image/jpeg");
        if (supabaseUrl) {
            return NextResponse.json({ url: supabaseUrl });
        }

        // Fallback: local filesystem
        const uploadDir = join(process.cwd(), "public", "uploads", folder);
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), buffer);
        return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
    } catch (e: any) {
        console.error("[upload] Fatal error:", e);
        return NextResponse.json({ error: e.message || "Failed to upload file." }, { status: 500 });
    }
}
