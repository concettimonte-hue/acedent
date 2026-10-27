// Inlined before Vite assets: recovery must also work when the entry bundle fails.
(function () {
  var retryKey = '__acedent_asset_retry';
  var storageKey = 'acedent:asset-recovery';
  var current = new URL(window.location.href);
  var alreadyRetried = current.searchParams.has(retryKey);
  var navigating = false;
  var noticeQueued = false;
  var retriedStyles = new WeakSet();
  var publicPage = current.pathname === '/' || /^\/works(?:\/|$)/.test(current.pathname);

  // Keep recovery parameters out of canonical URLs, analytics and shared links.
  if (alreadyRetried) {
    current.searchParams.delete(retryKey);
    window.history.replaceState(window.history.state, '', current.href);
  }

  function localAsset(value) {
    try {
      var url = new URL(value, current.href);
      return url.origin === current.origin && /^\/assets\/.+\.(?:css|js)$/.test(url.pathname);
    } catch (_) { return false; }
  }

  function freshPage() {
    var url = new URL(window.location.href);
    url.searchParams.set(retryKey, String(Date.now()));
    return url.href;
  }

  function showNotice() {
    if (noticeQueued) return;
    noticeQueued = true;
    function render() {
      var notice = document.createElement('aside');
      notice.id = 'acedent-asset-recovery';
      notice.setAttribute('role', 'alert');
      // Independent of the stylesheet that may have failed to load.
      notice.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:2147483647;padding:16px;background:#151515;color:#fff;border:1px solid #eedb32;font:14px/1.6 sans-serif;box-sizing:border-box';
      var text = document.createElement('p');
      text.style.cssText = 'margin:0 0 10px';
      text.textContent = publicPage
        ? '화면 파일을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 열어주세요.'
        : '화면 파일을 불러오지 못했습니다. 작성 중인 내용이 있다면 별도로 보관한 뒤 다시 열어주세요. 자동으로 새로고침하지 않습니다.';
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = '최신 화면 다시 열기';
      button.style.cssText = 'padding:9px 14px;background:#eedb32;color:#111;border:0;font:inherit;cursor:pointer';
      button.addEventListener('click', function () {
        if (!publicPage && !window.confirm('저장하지 않은 입력은 사라질 수 있습니다. 작성 내용을 보관했으며 다시 여시겠습니까?')) return;
        window.location.replace(freshPage());
      });
      notice.append(text, button);
      document.body.appendChild(notice);
    }
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  function recoverPage() {
    if (navigating) return;
    if (!publicPage || alreadyRetried || window.navigator.onLine === false) {
      showNotice();
      return;
    }
    var now = Date.now();
    try {
      var previous = Number(window.sessionStorage.getItem(storageKey));
      if (previous && now - previous < 10 * 60 * 1000) { showNotice(); return; }
      window.sessionStorage.setItem(storageKey, String(now));
    } catch (_) {
      // The URL marker still bounds retries when storage is unavailable.
    }
    navigating = true;
    window.location.replace(freshPage());
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (!target) return;
    if (target.tagName === 'LINK' && target.rel === 'stylesheet' && localAsset(target.href)) {
      if (!retriedStyles.has(target)) {
        retriedStyles.add(target);
        var url = new URL(target.href);
        url.searchParams.set(retryKey, String(Date.now()));
        target.href = url.href;
        return;
      }
      recoverPage();
    } else if (target.tagName === 'SCRIPT' && target.type === 'module' && localAsset(target.src)) {
      recoverPage();
    }
  }, true);

  // Vite reports failed lazy JS/CSS imports separately from initial asset errors.
  window.addEventListener('vite:preloadError', function () { recoverPage(); });
}());
