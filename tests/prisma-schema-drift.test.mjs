import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// 실제 사고(2026-08-09): 학부모 마이페이지가 통째로 죽었다.
// DB에는 있는 Student.mergedIntoStudentId 가 schema.prisma 에만 빠져 있었고,
// 그 필드를 ORM 조회에 쓰다가 PrismaClientValidationError 가 났다.
//
// 왜 tsc 가 못 잡았나: 스프레드(`where: { ...NOT_MERGED_STUDENT }`)로 넘기면
// TypeScript 의 초과 속성 검사가 작동하지 않는다. 그래서 여기서 잡는다.

const schema = await readFile("prisma/schema.prisma", "utf8");

function modelBlock(name) {
  const start = schema.indexOf(`model ${name} {`);
  assert.ok(start >= 0, `schema.prisma 에 model ${name} 이 없습니다.`);
  return schema.slice(start, schema.indexOf("\n}", start));
}

test("ORM 조회에 쓰는 병합 필드가 schema.prisma 에 선언돼 있다", async () => {
  const source = await readFile("src/lib/studentVisibility.ts", "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { NOT_MERGED_STUDENT } = await import(
    `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
  );

  const student = modelBlock("Student");
  for (const field of Object.keys(NOT_MERGED_STUDENT)) {
    assert.match(
      student,
      new RegExp(`^\\s*${field}\\s`, "m"),
      `Student.${field} 를 ORM 으로 조회하는데 schema.prisma 에 없습니다. 화면이 통째로 죽습니다.`,
    );
  }
});

test("병합 표시 필드 두 개가 모두 선언돼 있다", () => {
  // 흡수된 행을 지우지 않고 표시만 남기는 구조라 두 값이 짝으로 쓰인다.
  const student = modelBlock("Student");
  assert.match(student, /^\s*mergedIntoStudentId\s+String\?/m);
  assert.match(student, /^\s*mergedAt\s+DateTime\?/m);
});

test("병합 필드에 일반 인덱스를 걸지 않는다", () => {
  // DB 쪽은 부분 인덱스(WHERE ... IS NOT NULL)라 Prisma 로 표현할 수 없다.
  // 여기에 @@index 를 적으면 반대 방향으로 어긋나 불필요한 마이그레이션이 생긴다.
  const student = modelBlock("Student");
  assert.doesNotMatch(student, /@@index\(\[mergedIntoStudentId\]\)/);
});
