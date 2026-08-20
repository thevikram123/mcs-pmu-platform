/** Shared download-filename helper, kept out of the heavy export modules. */
export function safeFilename(scenarioName: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = scenarioName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
  return `MCS-Phase3-${slug}-${stamp}.${ext}`;
}
