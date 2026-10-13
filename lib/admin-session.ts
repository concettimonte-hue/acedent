// A page-lifetime status request shared by all gallery cards/filters.
// This is only a UI hint. Every admin endpoint verifies Access independently.
let sessionRequest: Promise<number> | undefined;

async function requestSession(): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch('/admin/api/session', {
      credentials: 'same-origin',
      mode: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status !== 200 || response.redirected ||
      response.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return 0;
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('authenticated' in body) || body.authenticated !== true ||
      !('expiresAt' in body) || typeof body.expiresAt !== 'number' ||
      !Number.isSafeInteger(body.expiresAt) || body.expiresAt <= Date.now()) return 0;
    return body.expiresAt;
  } catch {
    // Includes Access login redirects/HTML, offline, timeout and parse failure.
    // Guests see neither login navigation nor an error banner.
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

export function observeAdminSession(onChange: (canEdit: boolean) => void) {
  let disposed = false;
  let expiresAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    if (disposed) return;
    clearTimeout(timer);
    const remaining = expiresAt - Date.now();
    onChange(remaining > 0);
    if (remaining > 0) timer = setTimeout(update, Math.min(remaining, 2_147_483_647));
  };
  onChange(false);
  sessionRequest ??= requestSession();
  void sessionRequest.then((expiry) => { expiresAt = expiry; update(); });
  // Background timers may be throttled. Recheck the expiry on return/BFCache,
  // without polling or retrying the network request.
  window.addEventListener('pageshow', update);
  document.addEventListener('visibilitychange', update);
  return () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener('pageshow', update);
    document.removeEventListener('visibilitychange', update);
  };
}
