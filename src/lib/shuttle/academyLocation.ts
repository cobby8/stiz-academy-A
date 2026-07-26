// 학원(셔틀 기준점) 위치를 고르고 검증하는 순수 모듈.
//
// 왜 따로 떼어냈나:
//   좌표가 틀리면 T맵 경로 추천이 통째로 엉뚱한 곳으로 간다. 그래서 "어떤 값을 쓸지"와
//   "그 값이 말이 되는지"를 DB·환경변수 접근에서 분리해 회귀 테스트로 고정한다.
//   프로젝트 관례상 `@/` 별칭이 없어야 `node --test`로 바로 실행할 수 있다(외부 의존성 0).

export interface AcademyShuttleLocation {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** 값을 어디서 읽었는지. 화면 안내와 장애 추적용. */
  source: "SETTINGS" | "ENV";
}

/** 좌표 후보(문자열/숫자/NULL 무엇이든)를 받는 원본 값 묶음. */
export interface AcademyLocationSource {
  name?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

/** 값이 없을 때 쓰는 이름. 노선 출발/도착 칸이 빈 채로 저장되는 걸 막는다. */
export const DEFAULT_ACADEMY_PLACE_NAME = "학원";

// 대한민국 육상 영역의 넉넉한 경계.
// 좁게(예: 남양주 다산동)로 못 박으면 학원이 이전하는 순간 정상 값이 거부된다.
// 여기서는 "위경도가 뒤바뀌었다 / 0이 들어왔다 / 해외 좌표다" 수준의 사고만 걸러낸다.
const KOREA_BOUNDS = { minLatitude: 33, maxLatitude: 39, minLongitude: 124, maxLongitude: 132 } as const;

/**
 * 좌표 한 칸을 숫자로 바꾼다.
 * AcademySettings 컬럼이 TEXT라 "37.6145054" 같은 문자열로 들어오고,
 * 빈 문자열·공백·"null"·NaN은 전부 "값 없음"으로 본다.
 */
export function parseCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 두 좌표가 대한민국 범위 안인지. 위경도를 바꿔 넣은 실수도 여기서 걸린다. */
export function isKoreanCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= KOREA_BOUNDS.minLatitude
    && latitude <= KOREA_BOUNDS.maxLatitude
    && longitude >= KOREA_BOUNDS.minLongitude
    && longitude <= KOREA_BOUNDS.maxLongitude;
}

function trimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

/** 원본 한 벌을 검증해 완성된 위치로 만든다. 좌표가 하나라도 없거나 범위를 벗어나면 null. */
function toLocation(source: AcademyLocationSource, origin: AcademyShuttleLocation["source"]): AcademyShuttleLocation | null {
  const latitude = parseCoordinate(source.latitude);
  const longitude = parseCoordinate(source.longitude);
  if (latitude === null || longitude === null) return null;
  if (!isKoreanCoordinate(latitude, longitude)) return null;
  return {
    name: trimmedText(source.name) ?? DEFAULT_ACADEMY_PLACE_NAME,
    address: trimmedText(source.address),
    latitude,
    longitude,
    source: origin,
  };
}

/**
 * 정본은 DB(AcademySettings), 없으면 환경변수 순으로 고른다.
 *
 * DB를 먼저 보는 이유: 환경변수는 배포 환경마다 따로 넣어야 해서 한 곳만 빠지면
 * 반별 자동배치가 409로 죽는데, 원장이 스스로 고칠 방법이 없다.
 * 환경변수를 남겨 둔 이유: DB 컬럼이 아직 비어 있는 환경에서도 기존 동작이 그대로 유지돼야 한다.
 */
export function resolveAcademyShuttleLocation(input: {
  settings?: AcademyLocationSource | null;
  env?: AcademyLocationSource | null;
}): AcademyShuttleLocation | null {
  return toLocation(input.settings ?? {}, "SETTINGS") ?? toLocation(input.env ?? {}, "ENV");
}

/** 저장 전 검증. 화면에 그대로 띄울 한국어 사유를 함께 돌려준다. */
export function validateAcademyCoordinateInput(latitude: unknown, longitude: unknown):
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: string } {
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  if (parsedLatitude === null || parsedLongitude === null) {
    return { ok: false, reason: "학원 위도·경도를 숫자로 입력해 주세요." };
  }
  if (!isKoreanCoordinate(parsedLatitude, parsedLongitude)) {
    return { ok: false, reason: "학원 좌표가 대한민국 범위를 벗어났습니다. 위도와 경도를 바꿔 입력하지 않았는지 확인해 주세요." };
  }
  return { ok: true, latitude: parsedLatitude, longitude: parsedLongitude };
}
