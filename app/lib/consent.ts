export const CONSENT_VERSIONS = {
  terms: "2026-07-21",
  privacy: "2026-07-21",
  aiNotice: "2026-07-21",
  photoRights: "2026-07-21-photo-v1",
  depictedPeople: "2026-07-21-people-v1",
  minorGuardian: "2026-07-21-minor-v1",
  peoplePolicy: "2026-07-21-people-v1",
} as const;

export function hasCurrentConsent(order: {
  consented_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  external_ai_consent_at: string | null;
  ai_notice_version: string | null;
  contains_people: boolean | null;
  people_handling: string | null;
  contains_minors: boolean | null;
  photo_rights_consented_at: string | null;
  photo_rights_consent_version: string | null;
  depicted_people_consented_at: string | null;
  depicted_people_consent_version: string | null;
  minor_guardian_consented_at: string | null;
  minor_guardian_consent_version: string | null;
  people_policy_version: string | null;
}) {
  const peopleDetailsAreComplete = order.contains_people === false
    ? order.people_handling === "not_applicable" && order.contains_minors === false
    : order.contains_people === true
      && ["dog_only_crop", "anonymous_person", "original_still", "consult"].includes(order.people_handling ?? "")
      && typeof order.contains_minors === "boolean";
  const depictedPeopleConsentIsCurrent = order.contains_people === false || Boolean(
    order.depicted_people_consented_at
      && order.depicted_people_consent_version === CONSENT_VERSIONS.depictedPeople,
  );
  const minorGuardianConsentIsCurrent = order.contains_minors !== true || Boolean(
    order.minor_guardian_consented_at
      && order.minor_guardian_consent_version === CONSENT_VERSIONS.minorGuardian,
  );

  return Boolean(
    order.consented_at
      && order.external_ai_consent_at
      && order.photo_rights_consented_at
      && order.terms_version === CONSENT_VERSIONS.terms
      && order.privacy_version === CONSENT_VERSIONS.privacy
      && order.ai_notice_version === CONSENT_VERSIONS.aiNotice
      && order.photo_rights_consent_version === CONSENT_VERSIONS.photoRights
      && order.people_policy_version === CONSENT_VERSIONS.peoplePolicy
      && peopleDetailsAreComplete
      && depictedPeopleConsentIsCurrent
      && minorGuardianConsentIsCurrent,
  );
}
