// Only the static fallback DOM is handled here; React owns its own onError state.
(() => {
  const selector = 'img[data-static-vehicle-brand]';
  const hideBrokenLogo = (image) => {
    if (image instanceof HTMLImageElement && image.matches(selector) && image.complete && image.naturalWidth === 0) {
      image.remove();
    }
  };
  document.addEventListener('error', (event) => hideBrokenLogo(event.target), true);
  document.querySelectorAll(selector).forEach(hideBrokenLogo);
})();
