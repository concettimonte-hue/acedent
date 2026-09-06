export function withLandingUtm(url: string, medium: string) {
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=landing&utm_medium=${medium}`;
}
