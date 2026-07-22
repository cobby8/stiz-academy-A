export type CoordinateLinkInput = {
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
  name: string;
};

function finiteCoordinate(value: CoordinateLinkInput["latitude"], min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function coordinatePoint(input: CoordinateLinkInput) {
  const latitude = finiteCoordinate(input.latitude, -90, 90);
  const longitude = finiteCoordinate(input.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, name: input.name.trim() || "STIZ shuttle point" };
}

export function kakaoMapCoordinateUrl(input: CoordinateLinkInput) {
  const point = coordinatePoint(input);
  if (!point) return null;
  return `https://map.kakao.com/link/map/${encodeURIComponent(point.name)},${point.latitude},${point.longitude}`;
}

export function kakaoNavigationCoordinateUrl(input: CoordinateLinkInput) {
  const point = coordinatePoint(input);
  if (!point) return null;
  return `https://map.kakao.com/link/to/${encodeURIComponent(point.name)},${point.latitude},${point.longitude}`;
}

export function naverNavigationCoordinateUrl(input: CoordinateLinkInput) {
  const point = coordinatePoint(input);
  if (!point) return null;
  return `nmap://route/car?dlat=${point.latitude}&dlng=${point.longitude}&dname=${encodeURIComponent(point.name)}&appname=stiz-dasan`;
}

export function tmapNavigationCoordinateUrl(input: CoordinateLinkInput) {
  const point = coordinatePoint(input);
  if (!point) return null;
  return `tmap://route?goalname=${encodeURIComponent(point.name)}&goalx=${point.longitude}&goaly=${point.latitude}`;
}

export function coordinateLinkSet(input: CoordinateLinkInput) {
  return {
    point: coordinatePoint(input),
    kakaoMap: kakaoMapCoordinateUrl(input),
    kakaoNavigation: kakaoNavigationCoordinateUrl(input),
    naverNavigation: naverNavigationCoordinateUrl(input),
    tmapNavigation: tmapNavigationCoordinateUrl(input),
  };
}
