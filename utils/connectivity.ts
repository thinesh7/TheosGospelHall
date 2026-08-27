// This app has no NetInfo-style native connectivity module, so offline
// detection is done the same way bibleRemote.ts already treats a failed
// fetch as "offline": a fast request to a tiny, unauthenticated endpoint
// (the same one Android's own captive-portal/connectivity checks use) that
// only cares whether *any* response comes back, not its content.
export async function checkIsOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://www.gstatic.com/generate_204', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}
