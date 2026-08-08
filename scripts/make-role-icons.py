"""STIZ 역할별 앱 아이콘 생성.

이름 띠(선생님/학부모/DRIVER)를 없애고 배경색 + 우하단 배지로 역할을 구분한다.
글자는 홈 화면 크기(약 50px)에서 읽히지 않고, 앱 이름은 아이콘 밑에 이미 표시된다.

로고는 손으로 그리지 않고 기존 공식 아이콘(icon-v2-512.png)에서 흰색 픽셀만
뽑아 쓴다. 눈대중으로 브랜드 로고를 다시 그리면 모양이 틀어진다.
"""
from PIL import Image, ImageDraw
import os

SRC = "public/icon-v2-512.png"
OUT = "public"
S = 4  # 4배로 그린 뒤 줄여서 계단현상을 없앤다

NAVY = (15, 30, 74)
LIME = (204, 255, 0)
ORANGE = (242, 103, 34)
WHITE = (255, 255, 255)

ROLES = [
    # (파일이름, 배경색, 로고색, 배지바탕, 배지그림색, 그림종류)
    ("teacher", NAVY, WHITE, WHITE, NAVY, "clipboard"),
    ("parent", LIME, NAVY, NAVY, LIME, "family"),
    ("driver", ORANGE, WHITE, WHITE, ORANGE, "bus"),
]


def load_logo():
    """공식 아이콘에서 흰색 로고만 알파 마스크로 뽑아낸다.

    0/255 로 딱 잘라내면 확대할 때 가장자리가 계단처럼 깨진다. 주황 배경은 파랑이
    거의 없고(B≈34) 로고는 흰색(B=255)이라, 파랑 채널을 그대로 알파로 쓰면
    원본의 부드러운 가장자리가 그대로 살아난다.
    """
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    px = img.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    lo, hi = 90, 245
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 250 or r < 200:
                continue  # 바깥 둥근 모서리와 어두운 솔기는 제외
            t = (b - lo) / (hi - lo)
            mp[x, y] = max(0, min(255, round(t * 255)))
    return mask.crop(mask.getbbox())


def blend(c1, c2, t):
    return tuple(round(c1[i] * (1 - t) + c2[i] * t) for i in range(3))


def draw_seams(d, W, bg):
    """농구공 솔기. 배경색과 거의 차이 없게 깔아 브랜드 느낌만 남긴다."""
    dark = sum(bg) > 400
    seam = blend(bg, (0, 0, 0) if dark else (255, 255, 255), 0.085)
    lw = max(1, round(W * 0.011))
    d.line([(0, W // 2), (W, W // 2)], fill=seam, width=lw)
    # 세로 직선은 로고에 가려 보이지 않고, 곡선 두 줄만 남기면 농구공 솔기로 읽힌다.
    rx, ry = round(W * 0.335), round(W * 0.78)
    d.ellipse([W // 2 - rx, W // 2 - ry, W // 2 + rx, W // 2 + ry], outline=seam, width=lw)


def draw_glyph(d, kind, cx, cy, R, color, bgc):
    """배지 안의 그림. 홈 화면에서 10px 남짓이라 단순한 실루엣으로만 그린다."""
    if kind == "clipboard":
        # 코치 클립보드. 호루라기는 작게 줄이면 돋보기처럼 보여 알아볼 수 없었다.
        d.rounded_rectangle(
            [cx - 0.46 * R, cy - 0.56 * R, cx + 0.46 * R, cy + 0.62 * R],
            radius=0.15 * R, fill=color,
        )
        d.rounded_rectangle(
            [cx - 0.22 * R, cy - 0.72 * R, cx + 0.22 * R, cy - 0.44 * R],
            radius=0.10 * R, fill=color,
        )
        d.rounded_rectangle(
            [cx - 0.26 * R, cy - 0.20 * R, cx + 0.26 * R, cy - 0.06 * R],
            radius=0.07 * R, fill=bgc,
        )
        d.rounded_rectangle(
            [cx - 0.26 * R, cy + 0.10 * R, cx + 0.10 * R, cy + 0.24 * R],
            radius=0.07 * R, fill=bgc,
        )
    elif kind == "family":
        # 어른
        d.ellipse([cx - 0.62 * R, cy - 0.62 * R, cx - 0.18 * R, cy - 0.18 * R], fill=color)
        d.pieslice([cx - 0.76 * R, cy - 0.22 * R, cx - 0.04 * R, cy + 0.62 * R], 180, 360, fill=color)
        # 아이
        d.ellipse([cx + 0.06 * R, cy - 0.34 * R, cx + 0.40 * R, cy], fill=color)
        d.pieslice([cx - 0.04 * R, cy - 0.06 * R, cx + 0.50 * R, cy + 0.60 * R], 180, 360, fill=color)
    elif kind == "bus":
        d.rounded_rectangle(
            [cx - 0.62 * R, cy - 0.56 * R, cx + 0.62 * R, cy + 0.34 * R],
            radius=0.18 * R, fill=color,
        )
        d.rounded_rectangle(
            [cx - 0.44 * R, cy - 0.36 * R, cx + 0.44 * R, cy - 0.04 * R],
            radius=0.07 * R, fill=bgc,
        )
        d.ellipse([cx - 0.52 * R, cy + 0.24 * R, cx - 0.20 * R, cy + 0.56 * R], fill=color)
        d.ellipse([cx + 0.20 * R, cy + 0.24 * R, cx + 0.52 * R, cy + 0.56 * R], fill=color)


def build(logo, size, bg, logo_color, badge_bg, glyph_color, glyph, maskable):
    W = size * S
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        # 안드로이드가 바깥을 깎아내므로 모서리를 둥글리지 않고 꽉 채운다.
        d.rectangle([0, 0, W, W], fill=bg + (255,))
    else:
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=round(W * 0.235), fill=bg + (255,))
    draw_seams(d, W, bg)

    # maskable 은 가운데 80% 안에 내용을 모은다. 깎여도 잘리지 않게.
    lscale, lcx, lcy = (0.435, 0.445, 0.425) if maskable else (0.505, 0.450, 0.425)
    bcx, bcy, br = (0.680, 0.680, 0.122) if maskable else (0.755, 0.755, 0.146)

    lw = round(W * lscale)
    lh = round(lw * logo.height / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS)
    plate = Image.new("RGBA", (W, W), logo_color + (0,))
    plate.putalpha(Image.new("L", (W, W), 0))
    solid = Image.new("RGBA", (lw, lh), logo_color + (255,))
    img.paste(solid, (round(W * lcx - lw / 2), round(W * lcy - lh / 2)), lg)

    # 배지 둘레에 배경색 링을 둘러 로고와 겹쳐 보이지 않게 한다.
    cx, cy = W * bcx, W * bcy
    ring = br * W + W * 0.026
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], fill=bg + (255,))
    r = br * W
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=badge_bg + (255,))
    draw_glyph(d, glyph, cx, cy, r, glyph_color + (255,), badge_bg + (255,))

    return img.resize((size, size), Image.LANCZOS)


def main():
    logo = load_logo()
    print(f"logo {logo.size}")
    for name, bg, lc, bb, gc, glyph in ROLES:
        for size in (192, 512):
            for maskable in (False, True):
                img = build(logo, size, bg, lc, bb, gc, glyph, maskable)
                tag = "-maskable" if maskable else ""
                path = f"{OUT}/icon-{name}{tag}-{size}.png"
                img.save(path)
                print(path, os.path.getsize(path))


main()
