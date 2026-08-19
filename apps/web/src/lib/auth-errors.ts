export function translateAuthError(
  error: Error | string,
  t: (key: string) => string
): string {
  const msg = typeof error === "string" ? error : error.message;

  if (/invalid\s*(login|credentials)/i.test(msg)) return t("authErrors.invalidCredentials");
  if (/email\s*not\s*confirmed/i.test(msg)) return t("authErrors.emailNotConfirmed");
  if (/rate\s*limit/i.test(msg)) return t("authErrors.rateLimitExceeded");
  if (/already\s*(registered|exists)/i.test(msg)) return t("authErrors.userAlreadyExists");
  if (/user\s*not\s*found/i.test(msg)) return t("authErrors.userNotFound");
  if (/invalid\s*email/i.test(msg)) return t("authErrors.invalidEmail");
  if (/(weak|short)\s*password/i.test(msg)) return t("authErrors.weakPassword");
  if (/expired/i.test(msg)) return t("authErrors.expiredLink");

  return t("authErrors.default");
}
