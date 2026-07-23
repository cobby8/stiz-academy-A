import { ImageResponse } from "next/og";
import { PUBLIC_SITE_NAME } from "@/lib/publicMetadata";

export const alt = "STIZ 농구교실 다산점";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07101f",
          color: "white",
          padding: "58px 68px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-60px",
            top: "-90px",
            width: "420px",
            height: "420px",
            borderRadius: "999px",
            border: "56px solid rgba(204,255,0,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-120px",
            bottom: "-150px",
            width: "520px",
            height: "520px",
            borderRadius: "999px",
            border: "70px solid rgba(255,106,0,0.18)",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "74px",
                height: "74px",
                borderRadius: "22px",
                background: "#ff6a00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "42px",
                fontWeight: 900,
              }}
            >
              S
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "34px", fontWeight: 900, letterSpacing: "0" }}>STIZ</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ccff00" }}>BASKETBALL CLUB DASAN</div>
            </div>
          </div>
          <div
            style={{
              borderRadius: "999px",
              background: "#ccff00",
              color: "#07101f",
              padding: "14px 24px",
              fontSize: "22px",
              fontWeight: 900,
            }}
          >
            Trial Class Open
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "840px", zIndex: 1 }}>
          <div style={{ fontSize: "72px", lineHeight: 1.05, fontWeight: 900, letterSpacing: "0" }}>
            Dasan No.1 Youth Basketball Academy
          </div>
          <div style={{ fontSize: "30px", lineHeight: 1.35, color: "#c8d2e3", fontWeight: 700 }}>
            Professional coaching, level-based classes, shuttle guidance, and easy trial enrollment.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 1 }}>
          <div style={{ display: "flex", gap: "14px" }}>
            {["Kids", "Elementary", "Middle School", "Trial"].map((label) => (
              <div
                key={label}
                style={{
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "12px 18px",
                  fontSize: "20px",
                  fontWeight: 800,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#ccff00" }}>{PUBLIC_SITE_NAME}</div>
        </div>
      </div>
    ),
    size,
  );
}
