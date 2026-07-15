export type PhotoPublicationState = {
  draftStatus: string;
  visibility: string;
  hasPublishedCopy: boolean;
  hasGalleryPost: boolean;
  hasInstagramPost: boolean;
};

const EDITABLE_DRAFT_STATUSES = new Set(["DRAFT", "READY", "FAILED", "REJECTED"]);

export function evaluatePhotoManagement(state: PhotoPublicationState) {
  const requiresDeletionQueue = state.visibility === "PUBLIC"
    || state.hasPublishedCopy
    || state.draftStatus === "PUBLISHING"
    || state.draftStatus === "PUBLISHED"
    || state.hasGalleryPost
    || state.hasInstagramPost;
  return {
    requiresDeletionQueue,
    canManage: EDITABLE_DRAFT_STATUSES.has(state.draftStatus) && !requiresDeletionQueue,
  };
}

export function isSinglePhotoDraft(mediaCount: number) {
  return Number.isInteger(mediaCount) && mediaCount === 1;
}

export function sessionPhotoDeletionRetrySeconds(attempts: number) {
  return Math.min(3600, 30 * (2 ** Math.max(0, attempts - 1)));
}

export function isValidQueuedSessionPhotoRef(storageBucket: string, storagePath: string) {
  return storageBucket === "staff-session-private"
    && /^staff-sessions\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(storagePath);
}
