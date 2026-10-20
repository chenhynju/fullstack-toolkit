/** Canonical identifier for build reports; rejects unsafe path fragments. */
export function releaseLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(normalized)) {
    throw new Error('Release labels must contain 1–50 lowercase letters, digits or hyphens.');
  }
  return normalized;
}
