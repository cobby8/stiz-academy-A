type StaffCoachLinkDb = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => PromiseLike<number>;
};

function normalizePhone(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

export async function linkMatchingCoachProfileToUser(
  db: StaffCoachLinkDb,
  input: {
    userId: string;
    name: string;
    phone: string;
    role: string;
  },
) {
  if (input.role !== "INSTRUCTOR") return 0;

  const phone = normalizePhone(input.phone);
  const name = input.name.trim();
  if (!input.userId || (!phone && !name)) return 0;

  return db.$executeRawUnsafe(
    `UPDATE "Coach"
        SET "userId" = $1, "updatedAt" = NOW()
      WHERE id = (
        SELECT id
          FROM "Coach"
         WHERE "userId" IS NULL
           AND (
             NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '') = NULLIF($2, '')
             OR lower(trim(name)) = lower(trim($3))
           )
         ORDER BY
           CASE
             WHEN NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '') = NULLIF($2, '') THEN 0
             ELSE 1
           END,
           "order" ASC,
           name ASC
         LIMIT 1
      )`,
    input.userId,
    phone,
    name,
  );
}
