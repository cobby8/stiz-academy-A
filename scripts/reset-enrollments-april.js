/**
 * 4월 CSV 기준 Enrollment 완전 재설정 스크립트
 *
 * 기존 Enrollment을 전부 삭제하고, CSV 데이터 기준으로 새로 INSERT한다.
 * 4월 데이터가 있는 학생: 4월 기준으로 상태/수업 결정
 * 4월 데이터가 없는 학생: 마지막 월 데이터 기준으로 상태/수업 결정
 *
 * 결제방법 -> 상태 매핑:
 *   "휴원" -> PAUSED
 *   "퇴원", "결제취소" -> WITHDRAWN
 *   나머지 (랠리즈, 카드, 현금영수증 등) -> ACTIVE
 *   같은 학생이 같은 월에 여러 행이면, 하나라도 활성이면 ACTIVE
 */

const https = require('https');
const { Client } = require('pg');

// --- CSV URL ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/12xfQWT6OYa0hH2Ajei7E48CF2aUh6vZ8WWeFeocZrzY/export?format=csv&gid=672309223';

// --- DB 연결 (DIRECT_URL - PgBouncer 우회) ---
const DB_URL = 'postgresql://postgres.gpjdtkumqxzfgkixjamp:0203ASDqwe!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

// --- 요일 매핑: CSV 컬럼인덱스 -> slotKey 접두사 ---
const DAY_COLUMNS = {
  17: 'Mon',  // 수업선택 [월요일]
  18: 'Tue',  // 수업선택 [화요일]
  19: 'Wed',  // 수업선택 [수요일]
  20: 'Thu',  // 수업선택 [목요일]
  21: 'Fri',  // 수업선택 [금요일]
  22: 'Sat',  // 수업선택 [토요일]
  23: 'Sun',  // 수업선택 [일요일]
};

// --- 월 문자열을 정렬용 숫자로 변환 ---
function parseMonth(monthStr) {
  // "2026년 4월" -> { year: 2026, month: 4, sortKey: 202604 }
  const match = monthStr.match(/(\d{4})년\s*(\d{1,2})월/);
  if (!match) return { year: 0, month: 0, sortKey: 0 };
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  return { year, month, sortKey: year * 100 + month };
}

// --- 결제방법 -> Enrollment 상태 ---
function paymentToStatus(paymentMethod) {
  const trimmed = (paymentMethod || '').trim();
  if (trimmed === '휴원') return 'PAUSED';
  if (trimmed === '퇴원' || trimmed === '결제취소') return 'WITHDRAWN';
  return 'ACTIVE';
}

// --- CSV 행에서 slotKey 배열 추출 ---
// 예: 화요일 컬럼에 "4교시" -> "Tue-4", 토요일에 "1교시, 2교시" -> ["Sat-1", "Sat-2"]
function extractSlotKeys(row) {
  const keys = [];
  for (const [colIdx, dayPrefix] of Object.entries(DAY_COLUMNS)) {
    const cellValue = (row[parseInt(colIdx)] || '').trim();
    if (!cellValue) continue;

    // "4교시" 또는 "1교시, 2교시" (쉼표 구분 가능) 에서 숫자 추출
    const matches = cellValue.match(/(\d+)교시/g);
    if (matches) {
      matches.forEach(m => {
        const num = m.match(/(\d+)/)[1];
        keys.push(`${dayPrefix}-${num}`);
      });
    }
  }
  return keys;
}

// --- CSV 파싱 (큰따옴표 안 쉼표/줄바꿈 처리) ---
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else if (ch === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

// --- HTTPS로 CSV 다운로드 (리다이렉트 대응) ---
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const doFetch = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('리다이렉트 횟수 초과'));

      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doFetch(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    doFetch(url);
  });
}

// --- 메인 실행 ---
async function main() {
  console.log('=== 4월 CSV 기준 Enrollment 완전 재설정 ===\n');

  // ========== 1단계: CSV 다운로드 & 파싱 ==========
  console.log('[1] CSV 다운로드 중...');
  const csvText = await fetchCSV(CSV_URL);
  console.log(`    다운로드 완료: ${csvText.length.toLocaleString()} 바이트`);

  const rows = parseCSV(csvText);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  console.log(`    전체: 헤더 1행 + 데이터 ${dataRows.length}행\n`);

  // 컬럼 인덱스 (CSV 구조에서 확인된 값)
  const COL = {
    name: 3,         // 수강생 이름
    month: 7,        // 수강신청 월
    payment: 8,      // 결제방법
    parentPhone: 27, // 학부모 전화번호(숫자만)
    // 17~23: 수업선택 [월~일] -> DAY_COLUMNS에서 처리
  };

  // ========== 2단계: 월별 통계 ==========
  console.log('[2] 수강신청월별 행 수:');
  const monthCounts = {};
  dataRows.forEach(r => {
    const m = (r[COL.month] || '').trim();
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  Object.entries(monthCounts).sort().forEach(([m, c]) => {
    console.log(`    ${m}: ${c}건`);
  });
  console.log();

  // ========== 3단계: 학생별 그룹핑 (전체 월) ==========
  console.log('[3] 학생별 그룹핑 (전체 월 데이터)...');

  // 학생 키: 이름 + 학부모전화 (동명이인 구분)
  const studentGroups = {};

  dataRows.forEach(r => {
    const name = (r[COL.name] || '').trim();
    const parentPhone = (r[COL.parentPhone] || '').trim().replace(/[^0-9]/g, '');
    const monthStr = (r[COL.month] || '').trim();
    const payment = (r[COL.payment] || '').trim();
    const slotKeys = extractSlotKeys(r);

    if (!name || !monthStr) return;

    const key = `${name}|${parentPhone}`;
    if (!studentGroups[key]) {
      studentGroups[key] = { name, parentPhone, records: [] };
    }

    studentGroups[key].records.push({
      monthStr,
      payment,
      sortKey: parseMonth(monthStr).sortKey,
      slotKeys,
    });
  });

  const totalStudents = Object.keys(studentGroups).length;
  console.log(`    고유 학생 수: ${totalStudents}명\n`);

  // ========== 4단계: 4월 기준 분류 ==========
  console.log('[4] 4월 기준 분류...');

  const APRIL_KEY = 202604; // 2026년 4월

  // 4월 데이터가 있는 학생 vs 없는 학생 분리
  const aprilStudents = [];     // 4월 데이터 있음
  const nonAprilStudents = [];  // 4월 데이터 없음 (1~3월만)

  Object.entries(studentGroups).forEach(([key, group]) => {
    // 4월 행만 필터
    const aprilRecords = group.records.filter(r => r.sortKey === APRIL_KEY);

    if (aprilRecords.length > 0) {
      // 4월 데이터 있음: 4월 기준으로 상태/수업 결정
      // 같은 학생의 4월 행이 여러 개(주2회 등)이면 슬롯을 합치고, 상태는 활성 우선
      const allSlotKeys = [];
      let hasActive = false;
      let hasPaused = false;
      let lastPayment = '';

      aprilRecords.forEach(rec => {
        allSlotKeys.push(...rec.slotKeys);
        const status = paymentToStatus(rec.payment);
        if (status === 'ACTIVE') hasActive = true;
        if (status === 'PAUSED') hasPaused = true;
        lastPayment = rec.payment;
      });

      // 상태 결정: 하나라도 활성이면 ACTIVE, 아니면 마지막 결제방법 기준
      let finalStatus;
      if (hasActive) {
        finalStatus = 'ACTIVE';
      } else if (hasPaused) {
        finalStatus = 'PAUSED';
      } else {
        finalStatus = paymentToStatus(lastPayment);
      }

      // slotKeys 중복 제거
      const uniqueSlots = [...new Set(allSlotKeys)];

      aprilStudents.push({
        name: group.name,
        parentPhone: group.parentPhone,
        status: finalStatus,
        slotKeys: uniqueSlots,
        sourceMonth: '2026년 4월',
        payment: aprilRecords.map(r => r.payment).join(', '),
      });
    } else {
      // 4월 데이터 없음: 마지막 월 데이터 사용
      group.records.sort((a, b) => b.sortKey - a.sortKey);

      // 마지막 월의 모든 행 수집
      const latestSortKey = group.records[0].sortKey;
      const latestRecords = group.records.filter(r => r.sortKey === latestSortKey);

      const allSlotKeys = [];
      let hasActive = false;
      let hasPaused = false;
      let lastPayment = '';

      latestRecords.forEach(rec => {
        allSlotKeys.push(...rec.slotKeys);
        const status = paymentToStatus(rec.payment);
        if (status === 'ACTIVE') hasActive = true;
        if (status === 'PAUSED') hasPaused = true;
        lastPayment = rec.payment;
      });

      let finalStatus;
      if (hasActive) {
        finalStatus = 'ACTIVE';
      } else if (hasPaused) {
        finalStatus = 'PAUSED';
      } else {
        finalStatus = paymentToStatus(lastPayment);
      }

      const uniqueSlots = [...new Set(allSlotKeys)];

      nonAprilStudents.push({
        name: group.name,
        parentPhone: group.parentPhone,
        status: finalStatus,
        slotKeys: uniqueSlots,
        sourceMonth: latestRecords[0].monthStr,
        payment: latestRecords.map(r => r.payment).join(', '),
      });
    }
  });

  // 4월 학생 상태 분포
  const aprilStatus = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
  aprilStudents.forEach(s => aprilStatus[s.status]++);
  console.log(`    4월 학생: ${aprilStudents.length}명 (ACTIVE ${aprilStatus.ACTIVE}, PAUSED ${aprilStatus.PAUSED}, WITHDRAWN ${aprilStatus.WITHDRAWN})`);

  // 1~3월만 학생 상태 분포
  const nonAprilStatus = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
  nonAprilStudents.forEach(s => nonAprilStatus[s.status]++);
  console.log(`    1~3월만 학생: ${nonAprilStudents.length}명 (ACTIVE ${nonAprilStatus.ACTIVE}, PAUSED ${nonAprilStatus.PAUSED}, WITHDRAWN ${nonAprilStatus.WITHDRAWN})`);
  console.log();

  // ========== 5단계: DB 연결 & 데이터 조회 ==========
  console.log('[5] DB 연결 중...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('    DB 연결 성공');

  // DB Student 조회 (이름 + 학부모 전화)
  const dbStudentsRes = await client.query(`
    SELECT s.id, s.name, u.phone AS parent_phone
    FROM "Student" s
    JOIN "User" u ON s."parentId" = u.id
  `);
  console.log(`    DB 학생 수: ${dbStudentsRes.rows.length}명`);

  // DB Class 조회 (slotKey -> classId)
  const dbClassesRes = await client.query(`
    SELECT id, "slotKey" FROM "Class" WHERE "slotKey" IS NOT NULL
  `);
  const slotToClassId = {};
  dbClassesRes.rows.forEach(c => { slotToClassId[c.slotKey] = c.id; });
  console.log(`    DB Class 수: ${dbClassesRes.rows.length}개 (slotKey 있는 것만)`);
  console.log();

  // ========== 6단계: CSV -> DB 학생 매칭 ==========
  console.log('[6] CSV <-> DB Student 매칭...');

  // DB 학생을 이름별로 그룹핑
  const dbByName = {};
  dbStudentsRes.rows.forEach(s => {
    const name = s.name.trim();
    if (!dbByName[name]) dbByName[name] = [];
    dbByName[name].push(s);
  });

  // 매칭 함수: CSV 학생 -> DB Student ID
  function matchStudent(csvStudent) {
    const dbCandidates = dbByName[csvStudent.name];
    if (!dbCandidates || dbCandidates.length === 0) return null;

    if (dbCandidates.length === 1) {
      // 동명이인 없음 -> 바로 매칭
      return dbCandidates[0].id;
    }

    // 동명이인 -> 학부모 전화번호로 2차 매칭
    const csvPhone = csvStudent.parentPhone.replace(/[^0-9]/g, '');
    const found = dbCandidates.find(s => {
      const dbPhone = (s.parent_phone || '').replace(/[^0-9]/g, '');
      return dbPhone === csvPhone && csvPhone.length > 0;
    });

    return found ? found.id : null;
  }

  // 전체 CSV 학생 (4월 + 비4월) 매칭
  const allCsvStudents = [...aprilStudents, ...nonAprilStudents];
  const matched = [];
  const unmatched = [];

  allCsvStudents.forEach(csvStudent => {
    const dbStudentId = matchStudent(csvStudent);
    if (dbStudentId) {
      matched.push({ ...csvStudent, dbStudentId });
    } else {
      unmatched.push(csvStudent);
    }
  });

  console.log(`    매칭 성공: ${matched.length}명`);
  console.log(`    미매칭 (DB에 없음): ${unmatched.length}명`);
  if (unmatched.length > 0) {
    unmatched.forEach(u => console.log(`      - ${u.name} (${u.parentPhone || '전화없음'}) [${u.sourceMonth}]`));
  }
  console.log();

  // ========== 7단계: slotKey -> classId 매칭 확인 ==========
  console.log('[7] slotKey -> classId 매칭 확인...');
  const unmatchedSlots = new Set();
  let totalSlotLinks = 0;

  matched.forEach(m => {
    m.slotKeys.forEach(sk => {
      if (!slotToClassId[sk]) {
        unmatchedSlots.add(sk);
      } else {
        totalSlotLinks++;
      }
    });
  });

  console.log(`    매칭 가능한 수업 연결: ${totalSlotLinks}건`);
  if (unmatchedSlots.size > 0) {
    console.log(`    [경고] DB에 없는 slotKey: ${[...unmatchedSlots].join(', ')}`);
  }
  console.log();

  // ========== 8단계: 미리보기 - 반별 등록 현황 ==========
  console.log('[8] 미리보기 - 반별 등록 현황:');
  const classEnrollCount = {};
  const enrollPairs = []; // { studentId, classId, status }

  matched.forEach(m => {
    m.slotKeys.forEach(sk => {
      const classId = slotToClassId[sk];
      if (!classId) return; // 매칭 안 되는 slotKey 건너뛰기

      enrollPairs.push({
        studentId: m.dbStudentId,
        classId: classId,
        status: m.status,
      });

      if (!classEnrollCount[sk]) classEnrollCount[sk] = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
      classEnrollCount[sk][m.status]++;
    });
  });

  // 중복 제거 (같은 studentId + classId)
  const uniqueEnrollMap = new Map();
  enrollPairs.forEach(ep => {
    const key = `${ep.studentId}|${ep.classId}`;
    // 중복 시 ACTIVE 우선
    if (!uniqueEnrollMap.has(key)) {
      uniqueEnrollMap.set(key, ep);
    } else {
      const existing = uniqueEnrollMap.get(key);
      // ACTIVE > PAUSED > WITHDRAWN 우선순위
      const priority = { ACTIVE: 3, PAUSED: 2, WITHDRAWN: 1 };
      if ((priority[ep.status] || 0) > (priority[existing.status] || 0)) {
        uniqueEnrollMap.set(key, ep);
      }
    }
  });

  const finalEnrollments = [...uniqueEnrollMap.values()];

  // 반별 현황 재계산 (중복 제거 후)
  const finalClassCount = {};
  finalEnrollments.forEach(ep => {
    // slotKey 역매핑
    const slotKey = Object.entries(slotToClassId).find(([sk, id]) => id === ep.classId)?.[0] || '?';
    if (!finalClassCount[slotKey]) finalClassCount[slotKey] = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0, total: 0 };
    finalClassCount[slotKey][ep.status]++;
    finalClassCount[slotKey].total++;
  });

  Object.entries(finalClassCount).sort().forEach(([sk, counts]) => {
    console.log(`    ${sk}: 총 ${counts.total}명 (활성 ${counts.ACTIVE}, 휴원 ${counts.PAUSED}, 퇴원 ${counts.WITHDRAWN})`);
  });

  const statusTotal = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
  finalEnrollments.forEach(e => statusTotal[e.status]++);
  console.log(`\n    Enrollment 총: ${finalEnrollments.length}건 (ACTIVE ${statusTotal.ACTIVE}, PAUSED ${statusTotal.PAUSED}, WITHDRAWN ${statusTotal.WITHDRAWN})`);
  console.log();

  // ========== 9단계: 기존 Enrollment 삭제 ==========
  console.log('[9] 기존 Enrollment 전부 삭제...');
  const deleteResult = await client.query('DELETE FROM "Enrollment"');
  console.log(`    삭제 완료: ${deleteResult.rowCount}건\n`);

  // ========== 10단계: 새 Enrollment INSERT ==========
  console.log('[10] 새 Enrollment INSERT...');

  let insertCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const ep of finalEnrollments) {
    try {
      // ON CONFLICT로 중복 방지 (만약을 위한 안전장치)
      const result = await client.query(
        `INSERT INTO "Enrollment" (id, "studentId", "classId", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
         ON CONFLICT ("studentId", "classId") DO NOTHING`,
        [ep.studentId, ep.classId, ep.status]
      );
      if (result.rowCount > 0) {
        insertCount++;
      } else {
        skipCount++;
      }
    } catch (err) {
      errorCount++;
      console.log(`    [에러] studentId=${ep.studentId}, classId=${ep.classId}: ${err.message}`);
    }
  }

  console.log(`    INSERT 완료: ${insertCount}건 (스킵: ${skipCount}, 에러: ${errorCount})\n`);

  // ========== 11단계: 검증 ==========
  console.log('[11] 검증 - Enrollment 상태별 집계:');
  const verification = await client.query(`
    SELECT status, COUNT(*) as cnt
    FROM "Enrollment"
    GROUP BY status
    ORDER BY status
  `);
  verification.rows.forEach(r => {
    console.log(`    ${r.status}: ${r.cnt}건`);
  });

  const totalVerify = await client.query('SELECT COUNT(*) as cnt FROM "Enrollment"');
  console.log(`    총: ${totalVerify.rows[0].cnt}건`);

  // 반별 검증
  console.log('\n    반별 등록 현황 (DB 검증):');
  const classVerify = await client.query(`
    SELECT c."slotKey", c.name, COUNT(e.id) as cnt,
           COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) as active_cnt,
           COUNT(CASE WHEN e.status = 'PAUSED' THEN 1 END) as paused_cnt,
           COUNT(CASE WHEN e.status = 'WITHDRAWN' THEN 1 END) as withdrawn_cnt
    FROM "Class" c
    LEFT JOIN "Enrollment" e ON c.id = e."classId"
    WHERE c."slotKey" IS NOT NULL
    GROUP BY c."slotKey", c.name
    ORDER BY c."slotKey"
  `);
  classVerify.rows.forEach(r => {
    console.log(`    ${r.slotKey} (${r.name}): 총 ${r.cnt}명 (활성 ${r.active_cnt}, 휴원 ${r.paused_cnt}, 퇴원 ${r.withdrawn_cnt})`);
  });

  await client.end();
  console.log('\n=== 완료 ===');
}

main().catch(err => {
  console.error('스크립트 에러:', err);
  process.exit(1);
});
