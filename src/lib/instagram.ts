type GalleryMediaItem = {
  url: string;
  type: "image" | "video";
};

type InstagramChildMedia = {
  media_type?: string;
  media_url?: string;
};

export type InstagramRemoteMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: {
    data?: InstagramChildMedia[];
  };
};

type InstagramApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

function graphBaseUrl(accessToken = getAccessToken()) {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  const host = accessToken.startsWith("IG") ? "https://graph.instagram.com" : "https://graph.facebook.com";
  return version ? `${host}/${version}` : host;
}

function getAccessToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim() || "";
}

function getBusinessAccountId(override?: string | null) {
  return override?.trim() || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() || "";
}

function getPublicSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

function apiErrorMessage(body: InstagramApiError, fallback: string) {
  return body.error?.message || fallback;
}

function mediaTypeForInstagram(mediaType?: string): "image" | "video" {
  const normalized = mediaType?.toUpperCase() || "";
  return normalized.includes("VIDEO") || normalized.includes("REEL") ? "video" : "image";
}

function toAbsoluteMediaUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const siteUrl = getPublicSiteUrl();
  if (url.startsWith("/") && siteUrl) {
    return new URL(url, siteUrl).toString();
  }
  return "";
}

function parseGalleryMedia(mediaJSON: string): GalleryMediaItem[] {
  try {
    const parsed = JSON.parse(mediaJSON);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GalleryMediaItem => {
      return typeof item?.url === "string" && (item.type === "image" || item.type === "video");
    });
  } catch {
    return [];
  }
}

export function getInstagramRuntimeStatus(businessAccountId?: string | null) {
  const accessToken = getAccessToken();
  const resolvedBusinessAccountId = getBusinessAccountId(businessAccountId);
  return {
    hasAccessToken: Boolean(accessToken),
    hasBusinessAccountId: Boolean(resolvedBusinessAccountId),
  };
}

export function toGalleryMediaJSON(media: InstagramRemoteMedia) {
  const items: GalleryMediaItem[] = [];

  if (media.media_type === "CAROUSEL_ALBUM") {
    for (const child of media.children?.data || []) {
      if (child.media_url) {
        items.push({
          url: child.media_url,
          type: mediaTypeForInstagram(child.media_type),
        });
      }
    }
  } else if (media.media_url) {
    items.push({
      url: media.media_url,
      type: mediaTypeForInstagram(media.media_type),
    });
  }

  return JSON.stringify(items);
}

export async function fetchRecentInstagramMedia({
  businessAccountId,
  limit = 25,
}: {
  businessAccountId?: string | null;
  limit?: number;
}) {
  const accessToken = getAccessToken();
  const resolvedBusinessAccountId = getBusinessAccountId(businessAccountId);
  if (!accessToken || !resolvedBusinessAccountId) {
    return {
      ok: false as const,
      reason: "INSTAGRAM_ACCESS_TOKEN과 Instagram Business Account ID가 필요합니다.",
      media: [] as InstagramRemoteMedia[],
    };
  }

  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}",
    limit: String(limit),
    access_token: accessToken,
  });
  const res = await fetch(`${graphBaseUrl(accessToken)}/${resolvedBusinessAccountId}/media?${params.toString()}`, {
    cache: "no-store",
  });
  const body = await res.json() as InstagramApiError & { data?: InstagramRemoteMedia[] };

  if (!res.ok) {
    return {
      ok: false as const,
      reason: apiErrorMessage(body, "인스타그램 게시물을 가져오지 못했습니다."),
      media: [] as InstagramRemoteMedia[],
    };
  }

  return {
    ok: true as const,
    media: body.data || [],
  };
}

export async function publishGalleryPostToInstagram({
  businessAccountId,
  caption,
  mediaJSON,
}: {
  businessAccountId?: string | null;
  caption?: string | null;
  mediaJSON: string;
}) {
  const accessToken = getAccessToken();
  const resolvedBusinessAccountId = getBusinessAccountId(businessAccountId);
  if (!accessToken || !resolvedBusinessAccountId) {
    return {
      attempted: false,
      ok: false,
      skippedReason: "인스타그램 API 토큰 또는 계정 ID가 설정되지 않았습니다.",
    };
  }

  const image = parseGalleryMedia(mediaJSON).find((item) => item.type === "image");
  const imageUrl = image ? toAbsoluteMediaUrl(image.url) : "";
  if (!imageUrl) {
    return {
      attempted: false,
      ok: false,
      skippedReason: "인스타그램은 외부에서 접근 가능한 이미지 URL이 필요합니다.",
    };
  }

  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption?.trim() || "",
    access_token: accessToken,
  });
  const createRes = await fetch(`${graphBaseUrl(accessToken)}/${resolvedBusinessAccountId}/media`, {
    method: "POST",
    body: createParams,
  });
  const createBody = await createRes.json() as InstagramApiError & { id?: string };
  if (!createRes.ok || !createBody.id) {
    return {
      attempted: true,
      ok: false,
      error: apiErrorMessage(createBody, "인스타그램 미디어 컨테이너 생성에 실패했습니다."),
    };
  }

  const publishParams = new URLSearchParams({
    creation_id: createBody.id,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${graphBaseUrl(accessToken)}/${resolvedBusinessAccountId}/media_publish`, {
    method: "POST",
    body: publishParams,
  });
  const publishBody = await publishRes.json() as InstagramApiError & { id?: string };
  if (!publishRes.ok || !publishBody.id) {
    return {
      attempted: true,
      ok: false,
      error: apiErrorMessage(publishBody, "인스타그램 게시물 발행에 실패했습니다."),
    };
  }

  let permalink: string | null = null;
  try {
    const permalinkParams = new URLSearchParams({
      fields: "permalink",
      access_token: accessToken,
    });
    const permalinkRes = await fetch(`${graphBaseUrl(accessToken)}/${publishBody.id}?${permalinkParams.toString()}`, {
      cache: "no-store",
    });
    const permalinkBody = await permalinkRes.json() as { permalink?: string };
    permalink = permalinkBody.permalink || null;
  } catch {
    permalink = null;
  }

  return {
    attempted: true,
    ok: true,
    instagramMediaId: publishBody.id,
    permalink,
  };
}
