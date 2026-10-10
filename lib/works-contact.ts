interface ContactVisibility {
  inline: boolean;
  collision: boolean;
  modal: boolean;
}

/** Observe existing UI only. No per-scroll handler, network call or shared modal state. */
export function observeWorksContactVisibility(
  trigger: HTMLElement,
  onChange: (state: ContactVisibility) => void,
) {
  const state: ContactVisibility = { inline: false, collision: false, modal: false };
  const emit = () => onChange({ ...state });
  const inlineTargets = document.querySelectorAll('[data-work-contact-inline]');
  const inlineVisible = new Set<Element>();
  const inlineObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) inlineVisible.add(entry.target);
      else inlineVisible.delete(entry.target);
    }
    state.inline = inlineVisible.size > 0;
    emit();
  }, { threshold: [0, 0.5] });
  inlineTargets.forEach((target) => inlineObserver.observe(target));

  // Photo controls crossing the dock must remain tappable. The dock retains its
  // geometry while hidden, so the observer cannot oscillate from layout changes.
  let collisionObserver: IntersectionObserver | undefined;
  const rebuildCollisionObserver = () => {
    collisionObserver?.disconnect();
    const rect = trigger.getBoundingClientRect();
    const height = document.documentElement.clientHeight;
    const width = document.documentElement.clientWidth;
    const margin = 8;
    const top = Math.max(0, rect.top - margin);
    const left = Math.max(0, rect.left - margin);
    const right = Math.max(0, width - rect.right - margin);
    const bottom = Math.max(0, height - rect.bottom - margin);
    const visible = new Set<Element>();
    state.collision = false;
    emit();
    collisionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      state.collision = visible.size > 0;
      emit();
    }, { rootMargin: `-${top}px -${right}px -${bottom}px -${left}px` });
    document.querySelectorAll('.before-after-zoom-trigger, .work-photo-gallery-navigation')
      .forEach((target) => collisionObserver?.observe(target));
  };
  rebuildCollisionObserver();
  window.addEventListener('resize', rebuildCollisionObserver);

  const updateModal = () => {
    const modal = !!document.querySelector('[role="dialog"][aria-modal="true"]');
    if (modal !== state.modal) {
      state.modal = modal;
      emit();
    }
  };
  // Both existing photo viewers portal into body. Watch portal mounts only,
  // not every image/style/slider change across the document subtree.
  const modalObserver = new MutationObserver(updateModal);
  modalObserver.observe(document.body, { childList: true });
  updateModal();
  return () => {
    inlineObserver.disconnect();
    collisionObserver?.disconnect();
    modalObserver.disconnect();
    window.removeEventListener('resize', rebuildCollisionObserver);
  };
}
