export const CONSENT_VERSIONS = {
  terms: "2026-08-23-revision-2-1-v1",
  privacy: "2026-07-27",
  aiNotice: "2026-08-23-revision-2-1-v1",
  photoRights: "2026-07-25-photo-people-v2",
  peoplePolicy: "2026-07-25-people-policy-v2",
} as const;

export function hasCurrentConsent(order: {
  consented_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  external_ai_consent_at: string | null;
  ai_notice_version: string | null;
  photo_rights_consented_at: string | null;
  photo_rights_consent_version: string | null;
  people_policy_version: string | null;
}) {
  return Boolean(
    order.consented_at &&
      order.external_ai_consent_at &&
      order.photo_rights_consented_at &&
      order.terms_version === CONSENT_VERSIONS.terms &&
      order.privacy_version === CONSENT_VERSIONS.privacy &&
      order.ai_notice_version === CONSENT_VERSIONS.aiNotice &&
      order.photo_rights_consent_version === CONSENT_VERSIONS.photoRights &&
      order.people_policy_version === CONSENT_VERSIONS.peoplePolicy,
  );
}
