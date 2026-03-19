-- SheetSlotCache 테이블 생성
-- Supabase 대시보드 → SQL Editor에서 실행하거나
-- npx prisma db push (로컬 DIRECT_URL 필요) 로 적용

CREATE TABLE IF NOT EXISTS "SheetSlotCache" (
    "id"        TEXT NOT NULL DEFAULT 'singleton',
    "slotsJson" TEXT NOT NULL DEFAULT '[]',
    "syncedAt"  TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "SheetSlotCache_pkey" PRIMARY KEY ("id")
);
