export type GalleryMediaType = "image" | "video";

export type GalleryMediaItem = {
  url: string;
  type: GalleryMediaType;
};

function galleryMediaHostname(url: string) {
  try {
    return new URL(url, "https://www.stiz-dasan.kr").hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isUnstableInstagramMediaUrl(url: string) {
  const hostname = galleryMediaHostname(url);
  return hostname.endsWith("cdninstagram.com") || hostname.endsWith("fbcdn.net");
}

export function isDurableGalleryMediaUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  return !isUnstableInstagramMediaUrl(trimmed);
}

export function parseGalleryMediaJSON(mediaJSON: string): GalleryMediaItem[] {
  try {
    const parsed = JSON.parse(mediaJSON);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is { url: string; type?: string } => {
        return typeof item?.url === "string" && item.url.trim().length > 0;
      })
      .map((item) => ({
        url: item.url.trim(),
        type: item.type === "video" ? "video" : "image",
      }));
  } catch {
    return [];
  }
}
