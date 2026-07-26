-- 병합 스키마가 제대로 붙었는지 + 기존 데이터가 안 건드려졌는지 확인용 (읽기 전용)
-- 적용: psql "$DIRECT_URL" -f prisma/sql/verify_student_merge.sql

-- 1) 컬럼/테이블 존재
SELECT 'Student.mergedIntoStudentId' AS item,
       COUNT(*) FILTER (WHERE column_name = 'mergedIntoStudentId') AS ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Student'
UNION ALL
SELECT 'Student.mergedAt',
       COUNT(*) FILTER (WHERE column_name = 'mergedAt')
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Student'
UNION ALL
SELECT 'StudentMergeLog', COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'StudentMergeLog';

-- 2) 기존 데이터 무영향 확인: 병합 표시가 붙은 학생이 아직 0명이어야 한다
SELECT COUNT(*) AS merged_students FROM "Student" WHERE "mergedIntoStudentId" IS NOT NULL;

-- 3) 8월 청구 불변 기준선 (병합 전/후가 같아야 한다)
SELECT COUNT(*) AS aug_pending_count, COALESCE(SUM(amount), 0) AS aug_pending_total
FROM "Payment"
WHERE year = 2026 AND month = 8 AND status = 'PENDING';

SELECT COUNT(*) AS aug_issued_invoice_count, COALESCE(SUM(i.amount), 0) AS aug_issued_invoice_total
FROM "PaymentInvoice" i
JOIN "Payment" p ON p.id = i."paymentId"
WHERE p.year = 2026 AND p.month = 8 AND i.status = 'ISSUED';
