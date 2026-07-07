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

type InstagramPublishResult =
  | {
      attempted: false;
      ok: false;
      skippedReason: string;
    }
  | {
      attempted: true;
      ok: false;
      error: string;
    }
  | {
      attempted: true;
      ok: true;
      instagramMediaId: string;
      permalink: string | null;
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

async function createMediaContainer({
  accessToken,
  businessAccountId,
  params,
  fallback,
}: {
  accessToken: string;
  businessAccountId: string;
  params: URLSearchParams;
  fallback: string;
}) {
  const res = await fetch(`${graphBaseUrl(accessToken)}/${businessAccountId}/media`, {
    method: "POST",
    body: params,
  });
  const body = (await res.json()) as InstagramApiError & { id?: string };
  if (!res.ok || !body.id) {
    return {
      ok: false as const,
      error: apiErrorMessage(body, fallback),
    };
  }
  return { ok: true as const, id: body.id };
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
      reason: "Instagram access token and business account ID are required.",
      media: [] as InstagramRemoteMedia[],
    };
  }

  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}",
    limit: String(limit),
    access_token: accessToken,
  });

  let res: Response;
  try {
    res = await fetch(`${graphBaseUrl(accessToken)}/${resolvedBusinessAccountId}/media?${params.toString()}`, {
      cache: "no-store",
    });
  } catch (error) {
    console.error("[instagram] media fetch failed:", error);
    return {
      ok: false as const,
      reason: "Instagram API에 연결하지 못했습니다.",
      media: [] as InstagramRemoteMedia[],
    };
  }

  let body: InstagramApiError & { data?: InstagramRemoteMedia[] };
  try {
    body = (await res.json()) as InstagramApiError & { data?: InstagramRemoteMedia[] };
  } catch (error) {
    console.error("[instagram] media response parse failed:", error);
    return {
      ok: false as const,
      reason: "Instagram API 응답을 읽지 못했습니다.",
      media: [] as InstagramRemoteMedia[],
    };
  }

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
}): Promise<InstagramPublishResult> {
  const accessToken = getAccessToken();
  const resolvedBusinessAccountId = getBusinessAccountId(businessAccountId);
  if (!accessToken || !resolvedBusinessAccountId) {
    return {
      attempted: false,
      ok: false,
      skippedReason: "인스타그램 API 토큰 또는 계정 ID가 설정되지 않았습니다.",
    };
  }

  const imageUrls = parseGalleryMedia(mediaJSON)
    .filter((item) => item.type === "image")
    .map((item) => toAbsoluteMediaUrl(item.url))
    .filter(Boolean)
    .slice(0, 10);

  if (imageUrls.length === 0) {
    return {
      attempted: false,
      ok: false,
      skippedReason: "인스타그램은 외부에서 접근 가능한 이미지 URL이 필요합니다.",
    };
  }

  const captionText = caption?.trim() || "";
  let creationId: string;

  if (imageUrls.length === 1) {
    const createResult = await createMediaContainer({
      accessToken,
      businessAccountId: resolvedBusinessAccountId,
      params: new URLSearchParams({
        image_url: imageUrls[0],
        caption: captionText,
        access_token: accessToken,
      }),
      fallback: "인스타그램 미디어 컨테이너 생성에 실패했습니다.",
    });

    if (!createResult.ok) {
      return { attempted: true, ok: false, error: createResult.error };
    }
    creationId = createResult.id;
  } else {
    const childIds: string[] = [];

    for (const imageUrl of imageUrls) {
      const childResult = await createMediaContainer({
        accessToken,
        businessAccountId: resolvedBusinessAccountId,
        params: new URLSearchParams({
          image_url: imageUrl,
          is_carousel_item: "true",
          access_token: accessToken,
        }),
        fallback: "인스타그램 캐러셀 이미지 준비에 실패했습니다.",
      });

      if (!childResult.ok) {
        return { attempted: true, ok: false, error: childResult.error };
      }

      childIds.push(childResult.id);
    }

    const carouselResult = await createMediaContainer({
      accessToken,
      businessAccountId: resolvedBusinessAccountId,
      params: new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: captionText,
        access_token: accessToken,
      }),
      fallback: "인스타그램 캐러셀 게시물 생성에 실패했습니다.",
    });

    if (!carouselResult.ok) {
      return { attempted: true, ok: false, error: carouselResult.error };
    }
    creationId = carouselResult.id;
  }

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${graphBaseUrl(accessToken)}/${resolvedBusinessAccountId}/media_publish`, {
    method: "POST",
    body: publishParams,
  });
  const publishBody = (await publishRes.json()) as InstagramApiError & { id?: string };
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
    const permalinkBody = (await permalinkRes.json()) as { permalink?: string };
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
