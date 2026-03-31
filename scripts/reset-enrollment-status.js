/**
 * 수강생 Enrollment 상태 재설정 스크립트
 *
 * CSV(구글 스프레드시트)에서 수강신청 데이터를 가져와서
 * 각 학생의 최신 월 결제방법을 기반으로 Enrollment.status를 업데이트한다.
 *
 * 결제방법 -> 상태 매핑:
 *   "휴원" -> PAUSED
 *   "퇴원", "결제취소" -> WITHDRAWN
 *   나머지 (랠리즈, 카드, 현금영수증 등) -> ACTIVE
 */

const https = require('https');
const { Client } = require('pg');

// --- CSV URL ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/12xfQWT6OYa0hH2Ajei7E48CF2aUh6vZ8WWeFeocZrzY/export?format=csv&gid=672309223';

// --- DB 연결 (DIRECT_URL 사용 - PgBouncer 우회) ---
const DB_URL = 'postgresql://postgres.gpjdtkumqxzfgkixjamp:0203ASDqwe!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

// --- 월 문자열을 숫자로 변환 (정렬용) ---
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

// --- CSV 파싱 (큰따옴표 안 쉼표/줄바꿈 처리) ---
function parseCSV(text) {
  // BOM 제거
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
        // 이스케이프된 따옴표
        currentField += '"';
        i++;
      } else if (ch === '"') {
        // 따옴표 닫기
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
        i++; // \n 건너뛰기
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

  // 마지막 행 처리
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // 빈 행 제거
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

// --- HTTPS로 CSV 다운로드 ---
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const doFetch = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('리다이렉트 횟수 초과'));

      https.get(url, (res) => {
        // 리다이렉트 처리
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
  console.log('=== 수강생 Enrollment 상태 재설정 스크립트 ===\n');

  // 1. CSV 다운로드
  console.log('1. CSV 다운로드 중...');
  const csvText = await fetchCSV(CSV_URL);
  console.log(`   다운로드 완료: ${csvText.length.toLocaleString()} 바이트\n`);

  // 2. CSV 파싱
  console.log('2. CSV 파싱 중...');
  const rows = parseCSV(csvText);
  const headers = rows[0];
  const dataRows = rows.slice(1);

  console.log(`   전체 행 수: ${rows.length} (헤더 1행 + 데이터 ${dataRows.length}행)`);
  console.log(`   컬럼 수: ${headers.length}`);
  console.log(`   컬럼 헤더 전체:`);
  headers.forEach((h, i) => {
    console.log(`     [${i}] ${h}`);
  });
  console.log();

  // 3. 컬럼 인덱스 찾기 (정확한 컬럼명 기반)
  // 이전 분석에서 확인된 정확한 컬럼:
  //   [3] "수강생 이름", [7] "수강신청 월", [8] "결제방법", [27] "학부모 전화번호(숫자만)"
  const colMap = {
    name: 3,         // 수강생 이름
    month: 7,        // 수강신청 월
    payment: 8,      // 결제방법
    parentPhone: 27  // 학부모 전화번호(숫자만)
  };

  // 헤더 검증 - 실제 헤더와 일치하는지 확인
  console.log('3. 컬럼 매핑 확인:');
  console.log(`   수강신청 월: 컬럼 [${colMap.month}] "${headers[colMap.month] || '?'}"`);
  console.log(`   이름: 컬럼 [${colMap.name}] "${headers[colMap.name] || '?'}"`);
  console.log(`   결제방법: 컬럼 [${colMap.payment}] "${headers[colMap.payment] || '?'}"`);
  console.log(`   학부모 전화: 컬럼 [${colMap.parentPhone}] "${headers[colMap.parentPhone] || '?'}"`);
  console.log();

  // 수강신청 월이 H열(인덱스 7)이라고 이전 분석에서 확인됨
  // 그래도 헤더에서 찾은 결과로 검증
  if (colMap.month === undefined) {
    console.log('   [경고] 헤더에서 "수강신청" 컬럼을 못 찾음. 인덱스 7(H열)로 fallback');
    colMap.month = 7;
  }

  // 이름 컬럼도 못 찾으면, 전체 헤더를 보고 수동 확인 필요
  // 일단 첫 5개 데이터행 샘플 출력
  console.log('   첫 3행 샘플 (주요 컬럼):');
  for (let i = 0; i < Math.min(3, dataRows.length); i++) {
    const r = dataRows[i];
    console.log(`     행${i+1}: 이름=[${r[colMap.name] || '?'}] 월=[${r[colMap.month] || '?'}] 결제=[${r[colMap.payment] || '?'}] 학부모전화=[${r[colMap.parentPhone] || '?'}]`);
  }
  console.log();

  // 4. 수강신청월별 통계
  console.log('4. 수강신청월별 행 수:');
  const monthCounts = {};
  dataRows.forEach(r => {
    const m = (r[colMap.month] || '').trim();
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  Object.entries(monthCounts).sort().forEach(([m, c]) => {
    console.log(`   ${m}: ${c}건`);
  });
  console.log();

  // 5. 결제방법별 통계
  console.log('5. 결제방법별 행 수:');
  const paymentCounts = {};
  dataRows.forEach(r => {
    const p = (r[colMap.payment] || '').trim();
    paymentCounts[p] = (paymentCounts[p] || 0) + 1;
  });
  Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`   ${p || '(빈값)'}: ${c}건 -> ${paymentToStatus(p)}`);
  });
  console.log();

  // 6. 학생별 그룹핑 (이름 + 학부모전화)
  console.log('6. 학생별 그룹핑 (이름 + 학부모전화)...');
  const studentGroups = {};

  dataRows.forEach(r => {
    const name = (r[colMap.name] || '').trim();
    const parentPhone = (r[colMap.parentPhone] || '').trim().replace(/[^0-9]/g, ''); // 숫자만
    const monthStr = (r[colMap.month] || '').trim();
    const payment = (r[colMap.payment] || '').trim();

    if (!name || !monthStr) return; // 이름이나 월 없으면 스킵

    // 그룹 키: 이름 + 학부모전화 (동명이인 구분)
    const key = `${name}|${parentPhone}`;

    if (!studentGroups[key]) {
      studentGroups[key] = {
        name,
        parentPhone,
        records: []
      };
    }

    studentGroups[key].records.push({
      monthStr,
      payment,
      sortKey: parseMonth(monthStr).sortKey
    });
  });

  console.log(`   고유 학생 수: ${Object.keys(studentGroups).length}명\n`);

  // 7. 각 그룹에서 가장 최신 월의 결제방법으로 상태 결정
  console.log('7. 최신 월 기준 상태 결정...');
  const statusDecisions = {};  // key -> { name, parentPhone, status, latestMonth, latestPayment }

  Object.entries(studentGroups).forEach(([key, group]) => {
    // 가장 최신 월 찾기
    group.records.sort((a, b) => b.sortKey - a.sortKey);
    const latest = group.records[0];
    const status = paymentToStatus(latest.payment);

    statusDecisions[key] = {
      name: group.name,
      parentPhone: group.parentPhone,
      status,
      latestMonth: latest.monthStr,
      latestPayment: latest.payment
    };
  });

  // 상태별 집계
  const statusSummary = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
  Object.values(statusDecisions).forEach(d => {
    statusSummary[d.status]++;
  });

  console.log(`   ACTIVE: ${statusSummary.ACTIVE}명`);
  console.log(`   PAUSED: ${statusSummary.PAUSED}명`);
  console.log(`   WITHDRAWN: ${statusSummary.WITHDRAWN}명`);
  console.log(`   합계: ${Object.values(statusSummary).reduce((a, b) => a + b, 0)}명\n`);

  // 상태별 샘플 출력
  console.log('   [샘플] PAUSED:');
  Object.values(statusDecisions).filter(d => d.status === 'PAUSED').slice(0, 5).forEach(d => {
    console.log(`     ${d.name} (${d.parentPhone || '전화없음'}) <- ${d.latestMonth} ${d.latestPayment}`);
  });
  console.log('   [샘플] WITHDRAWN:');
  Object.values(statusDecisions).filter(d => d.status === 'WITHDRAWN').slice(0, 5).forEach(d => {
    console.log(`     ${d.name} (${d.parentPhone || '전화없음'}) <- ${d.latestMonth} ${d.latestPayment}`);
  });
  console.log();

  // 8. DB 연결 및 Student 조회
  console.log('8. DB 연결 중...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('   DB 연결 성공\n');

  // DB에서 모든 Student + 학부모(User) 전화번호 조회
  console.log('9. DB Student 조회 중...');
  const dbStudents = await client.query(`
    SELECT s.id, s.name, s.phone AS student_phone,
           u.phone AS parent_phone, u.name AS parent_name
    FROM "Student" s
    JOIN "User" u ON s."parentId" = u.id
  `);
  console.log(`   DB 학생 수: ${dbStudents.rows.length}명\n`);

  // 10. CSV 학생과 DB Student 매칭
  console.log('10. CSV <-> DB 매칭 중...');

  // DB 학생을 이름별로 그룹핑
  const dbByName = {};
  dbStudents.rows.forEach(s => {
    const name = s.name.trim();
    if (!dbByName[name]) dbByName[name] = [];
    dbByName[name].push(s);
  });

  const matched = [];      // { dbStudentId, csvName, status }
  const unmatched = [];    // CSV에는 있지만 DB에 없는 학생

  Object.values(statusDecisions).forEach(decision => {
    const dbCandidates = dbByName[decision.name];

    if (!dbCandidates || dbCandidates.length === 0) {
      unmatched.push(decision);
      return;
    }

    let matchedStudent = null;

    if (dbCandidates.length === 1) {
      // 동명이인 없음 -> 바로 매칭
      matchedStudent = dbCandidates[0];
    } else {
      // 동명이인 -> 학부모 전화번호로 2차 매칭
      const csvPhone = decision.parentPhone.replace(/[^0-9]/g, '');
      matchedStudent = dbCandidates.find(s => {
        const dbPhone = (s.parent_phone || '').replace(/[^0-9]/g, '');
        return dbPhone === csvPhone && csvPhone.length > 0;
      });

      if (!matchedStudent) {
        // 전화번호 매칭 실패 -> 첫번째로 fallback (경고 출력)
        console.log(`   [경고] 동명이인 "${decision.name}" (${dbCandidates.length}명) - 전화번호 매칭 실패, 첫번째 사용`);
        matchedStudent = dbCandidates[0];
      }
    }

    matched.push({
      dbStudentId: matchedStudent.id,
      dbStudentName: matchedStudent.name,
      csvName: decision.name,
      status: decision.status,
      latestMonth: decision.latestMonth,
      latestPayment: decision.latestPayment
    });
  });

  console.log(`   매칭 성공: ${matched.length}명`);
  console.log(`   미매칭 (CSV에만 있음): ${unmatched.length}명`);
  if (unmatched.length > 0 && unmatched.length <= 20) {
    unmatched.forEach(u => console.log(`     - ${u.name} (${u.parentPhone || '전화없음'})`));
  }
  console.log();

  // 11. 미리보기: 매칭된 학생의 상태 변경 내역
  console.log('11. 상태 변경 미리보기:');
  const matchedSummary = { ACTIVE: 0, PAUSED: 0, WITHDRAWN: 0 };
  matched.forEach(m => matchedSummary[m.status]++);
  console.log(`   ACTIVE: ${matchedSummary.ACTIVE}명`);
  console.log(`   PAUSED: ${matchedSummary.PAUSED}명`);
  console.log(`   WITHDRAWN: ${matchedSummary.WITHDRAWN}명\n`);

  // 12. 실제 UPDATE 실행
  console.log('12. Enrollment 상태 UPDATE 실행 중...');

  let updateCount = 0;
  let errorCount = 0;

  for (const m of matched) {
    try {
      // 해당 학생의 모든 Enrollment을 해당 상태로 UPDATE
      const result = await client.query(
        `UPDATE "Enrollment" SET status = $1, "updatedAt" = NOW() WHERE "studentId" = $2`,
        [m.status, m.dbStudentId]
      );
      updateCount += result.rowCount;
    } catch (err) {
      errorCount++;
      console.log(`   [에러] ${m.dbStudentName}: ${err.message}`);
    }
  }

  console.log(`   UPDATE 완료: ${updateCount}건 (에러: ${errorCount}건)\n`);

  // 13. 검증: 상태별 Enrollment 수 조회
  console.log('13. 검증 - Enrollment 상태별 집계:');
  const verification = await client.query(`
    SELECT status, COUNT(*) as cnt
    FROM "Enrollment"
    GROUP BY status
    ORDER BY status
  `);
  verification.rows.forEach(r => {
    console.log(`   ${r.status}: ${r.cnt}건`);
  });

  // DB 연결 종료
  await client.end();
  console.log('\n=== 완료 ===');
}

main().catch(err => {
  console.error('스크립트 에러:', err);
  process.exit(1);
});
