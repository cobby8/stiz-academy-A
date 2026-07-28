/**
 * 기사 전용 PWA 아이콘 생성 스크립트
 * 기존 icon-v2-{size}.png 위에 'DRIVER' 뱃지(주황 띠)를 오버레이한다.
 * 실행: node scripts/gen-driver-icons.mjs
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const SIZES = [192, 512];

for (const size of SIZES) {
  const src = join(PUBLIC, `icon-v2-${size}.png`);

  // 뱃지 높이: 아이콘 크기의 22%
  const badgeH = Math.round(size * 0.22);
  const fontSize = Math.round(badgeH * 0.62);
  const letterSpacing = Math.round(fontSize * 0.18);

  // 오렌지 띠 + 흰색 굵은 텍스트 SVG 오버레이
  const badge = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${size - badgeH}" width="${size}" height="${badgeH}" fill="#FF6B00" rx="0" ry="0"/>
  <text
    x="${size / 2}" y="${size - badgeH / 2 + fontSize * 0.36}"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    letter-spacing="${letterSpacing}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
  >DRIVER</text>
</svg>`.trim();

  const out = join(PUBLIC, `icon-driver-${size}.png`);
  await sharp(src)
    .composite([{ input: Buffer.from(badge), top: 0, left: 0 }])
    .png()
    .toFile(out);

  console.log(`✅ ${out}`);
}

// maskable 버전도 생성 (배경 여백 있는 버전)
for (const size of SIZES) {
  const src = join(PUBLIC, `icon-maskable-v2-${size}.png`);

  const badgeH = Math.round(size * 0.20);
  const fontSize = Math.round(badgeH * 0.58);
  const letterSpacing = Math.round(fontSize * 0.15);

  const badge = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${size - badgeH}" width="${size}" height="${badgeH}" fill="#FF6B00"/>
  <text
    x="${size / 2}" y="${size - badgeH / 2 + fontSize * 0.36}"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    letter-spacing="${letterSpacing}"
    fill="white"
    text-anchor="middle"
  >DRIVER</text>
</svg>`.trim();

  const out = join(PUBLIC, `icon-driver-maskable-${size}.png`);
  await sharp(src)
    .composite([{ input: Buffer.from(badge), top: 0, left: 0 }])
    .png()
    .toFile(out);

  console.log(`✅ ${out}`);
}

console.log("\n🎉 기사 전용 아이콘 생성 완료");
