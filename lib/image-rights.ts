export const imageCreditText = '에이스덴트';
export const imageCopyrightNotice = '© 에이스덴트. 무단 복제·사용 금지.';
export const imageWatermarkText = 'ACEDENTSHOP.CO.KR';
export const imageWatermarkIconPath = '/favicon-192x192.png';
export const imageUsagePath = '/photo-usage/';

export function getImageRightsMetadata(siteUrl: string) {
  const usageUrl = siteUrl.replace(/\/+$/, '') + imageUsagePath;
  return {
    creator: {
      '@type': 'Organization',
      name: imageCreditText,
      url: siteUrl,
    },
    creditText: imageCreditText,
    copyrightNotice: imageCopyrightNotice,
    // Our own usage policy, not a Creative Commons/free-use license.
    license: usageUrl,
    acquireLicensePage: usageUrl + '#permission-request',
  };
}
