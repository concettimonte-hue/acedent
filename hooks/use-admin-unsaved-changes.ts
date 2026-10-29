'use client';

import { useEffect, useState } from 'react';

/** UI-only comparison: photos are identified by their URL/key, never serialized as bytes. */
export function adminFormSnapshot(value: unknown) {
  return JSON.stringify(value, (key, item) =>
    ['id', 'processing', 'blob', 'sourceBlob'].includes(key) ? undefined : item);
}

export function useAdminUnsavedChanges(value: string, options: {
  baselineRevision: number;
  enabled: boolean;
  busy: boolean;
  pendingInput: boolean;
}) {
  const { baselineRevision, enabled, busy, pendingInput } = options;
  const [baseline, setBaseline] = useState({ revision: baselineRevision, value });
  const resetting = baseline.revision !== baselineRevision;
  useEffect(() => {
    // Only loading a record or a completed draft save requests a new baseline.
    if (resetting) setBaseline({ revision: baselineRevision, value });
  }, [resetting, baselineRevision, value]);
  const dirty = enabled && !resetting && (pendingInput || value !== baseline.value);
  const shouldWarn = enabled && (dirty || busy);
  useEffect(() => {
    if (!shouldWarn) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // Browser-owned confirmation for reload/back/same-tab links.
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [shouldWarn]);
  return {
    dirty,
    // Capture the submitted value, not whatever may be on screen after the request.
    markSaved: (submitted: string) => setBaseline({ revision: baselineRevision, value: submitted }),
  };
}
