// 카카오 지도 JS SDK(브라우저 전용) 로더 — 마커·폴리라인 등 지도 렌더에 쓴다.
// LocationPickerModal은 자체 로더를 갖고 있고, 이 모듈은 지도 뷰(경로 표시)에서 재사용한다.

export interface KakaoLatLng { getLat(): number; getLng(): number }
export interface KakaoBounds { extend(ll: KakaoLatLng): void }
export interface KakaoMapObj { setBounds(b: KakaoBounds, ...pad: number[]): void; relayout(): void; setCenter(ll: KakaoLatLng): void }
export interface KakaoOverlay { setMap(m: KakaoMapObj | null): void }
export interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMapObj;
  Marker: new (opts: { position: KakaoLatLng; map?: KakaoMapObj }) => KakaoOverlay;
  Polyline: new (opts: { path: KakaoLatLng[]; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; strokeStyle?: string; map?: KakaoMapObj }) => KakaoOverlay;
  CustomOverlay: new (opts: { position: KakaoLatLng; content: string | HTMLElement; map?: KakaoMapObj; yAnchor?: number; xAnchor?: number; zIndex?: number }) => KakaoOverlay;
  load(cb: () => void): void;
}
export interface KakaoSdk { maps: KakaoMaps }

function kakaoGlobal(): KakaoSdk | undefined { return (window as unknown as { kakao?: KakaoSdk }).kakao; }

let mapsPromise: Promise<KakaoSdk> | null = null;
export function loadKakaoMaps(key: string): Promise<KakaoSdk> {
  if (kakaoGlobal()?.maps?.LatLng) return Promise.resolve(kakaoGlobal() as KakaoSdk);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const fail = () => { mapsPromise = null; reject(new Error("지도를 불러오지 못했습니다.")); };
    const start = () => { const k = kakaoGlobal(); if (!k) return fail(); k.maps.load(() => resolve(k)); };
    const existing = document.querySelector<HTMLScriptElement>('script[data-stiz-kakao-map="true"]');
    if (existing) {
      if (kakaoGlobal()?.maps) return start();
      existing.addEventListener("load", start, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.dataset.stizKakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.addEventListener("load", start, { once: true });
    script.addEventListener("error", () => { script.remove(); fail(); }, { once: true });
    document.head.appendChild(script);
  });
  return mapsPromise;
}
