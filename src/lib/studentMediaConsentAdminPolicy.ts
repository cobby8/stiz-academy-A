export type StudentMediaConsentScopes = {
  internalAllowed: boolean;
  galleryAllowed: boolean;
  instagramAllowed: boolean;
};

export function validateStudentMediaConsentScopes(scopes: StudentMediaConsentScopes): string | null {
  if (scopes.galleryAllowed && !scopes.internalAllowed) {
    return "갤러리 동의에는 내부 사진 보관 동의가 필요합니다.";
  }
  if (scopes.instagramAllowed && (!scopes.internalAllowed || !scopes.galleryAllowed)) {
    return "인스타그램 동의에는 내부 보관과 갤러리 동의가 모두 필요합니다.";
  }
  return null;
}

