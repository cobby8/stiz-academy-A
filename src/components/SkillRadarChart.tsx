"use client";

/**
 * 순수 SVG 레이더(스탯) 차트 — 외부 라이브러리 없이 구현
 * N각형 형태로 카테고리별 레벨을 시각화한다
 */

interface SkillRadarChartProps {
    // 카테고리 정보 배열 (이름 + 최대 레벨)
    categories: { name: string; maxLevel: number }[];
    // 현재 레벨 배열 (categories와 같은 순서)
    values: number[];
    // 차트 크기 (기본 280)
    size?: number;
}

export default function SkillRadarChart({
    categories,
    values,
    size = 280,
}: SkillRadarChartProps) {
    const n = categories.length;
    // 카테고리가 2개 미만이면 차트를 그릴 수 없다
    if (n < 2) {
        return (
            <div className="flex items-center justify-center text-gray-400 text-sm py-8">
                카테고리가 2개 이상 필요합니다.
            </div>
        );
    }

    const cx = size / 2; // 중심 X
    const cy = size / 2; // 중심 Y
    const radius = size / 2 - 40; // 차트 반지름 (라벨 공간 확보)
    const levels = 5; // 배경 격자 단계 수

    // 각도 계산 — 12시 방향(위쪽)부터 시계방향
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2; // 12시 방향

    // 극좌표 → 직교좌표 변환
    const polarToXY = (angle: number, r: number) => ({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
    });

    // 꼭짓점 좌표 배열 생성 (각 카테고리의 위치)
    const vertices = Array.from({ length: n }, (_, i) =>
        polarToXY(startAngle + i * angleStep, radius),
    );

    // 배경 격자 다각형 (5단계)
    const gridPolygons = Array.from({ length: levels }, (_, lvl) => {
        const r = (radius * (lvl + 1)) / levels;
        const points = Array.from({ length: n }, (_, i) =>
            polarToXY(startAngle + i * angleStep, r),
        );
        return points.map((p) => `${p.x},${p.y}`).join(" ");
    });

    // 데이터 다각형 — 각 카테고리의 (현재값 / 최대값) 비율로 반지름 결정
    const dataPoints = categories.map((cat, i) => {
        const ratio = Math.min(1, Math.max(0, (values[i] ?? 0) / cat.maxLevel));
        return polarToXY(startAngle + i * angleStep, radius * ratio);
    });
    const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[280px] h-auto mx-auto"
        >
            {/* 배경 격자 — 얇은 회색 다각형 5단계 */}
            {gridPolygons.map((points, i) => (
                <polygon
                    key={`grid-${i}`}
                    points={points}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                />
            ))}

            {/* 축선 — 중심에서 각 꼭짓점으로 */}
            {vertices.map((v, i) => (
                <line
                    key={`axis-${i}`}
                    x1={cx}
                    y1={cy}
                    x2={v.x}
                    y2={v.y}
                    stroke="#d1d5db"
                    strokeWidth="1"
                />
            ))}

            {/* 데이터 영역 — 반투명 오렌지 */}
            <polygon
                points={dataPolygon}
                fill="rgba(249, 115, 22, 0.25)"
                stroke="#f97316"
                strokeWidth="2"
            />

            {/* 데이터 포인트 — 각 꼭짓점에 작은 원 */}
            {dataPoints.map((p, i) => (
                <circle
                    key={`point-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#f97316"
                    stroke="#fff"
                    strokeWidth="1.5"
                />
            ))}

            {/* 카테고리 라벨 — 차트 바깥에 텍스트 */}
            {vertices.map((v, i) => {
                // 라벨 위치를 꼭짓점에서 약간 더 바깥으로
                const labelPos = polarToXY(
                    startAngle + i * angleStep,
                    radius + 22,
                );
                // 텍스트 앵커: 왼쪽/오른쪽/가운데 자동 결정
                const angle = startAngle + i * angleStep;
                const normalizedAngle =
                    ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                let textAnchor: "start" | "end" | "middle" = "middle";
                if (normalizedAngle > 0.1 && normalizedAngle < Math.PI - 0.1) {
                    textAnchor = "start";
                } else if (
                    normalizedAngle > Math.PI + 0.1 &&
                    normalizedAngle < 2 * Math.PI - 0.1
                ) {
                    textAnchor = "end";
                }

                return (
                    <text
                        key={`label-${i}`}
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor={textAnchor}
                        dominantBaseline="middle"
                        className="fill-gray-600 text-[11px] font-medium"
                    >
                        {categories[i].name}
                    </text>
                );
            })}

            {/* 레벨 숫자 — 데이터 포인트 위에 현재 레벨 표시 */}
            {dataPoints.map((p, i) => (
                <text
                    key={`val-${i}`}
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    className="fill-orange-600 text-[10px] font-bold"
                >
                    {values[i] ?? 0}
                </text>
            ))}
        </svg>
    );
}
