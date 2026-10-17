'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vite SPA admin routes intentionally reload saved state. */
import { useCallback, useEffect, useState } from 'react';
import { draftStateLabel, type DraftRecord } from '@/lib/work-drafts';

export default function AdminDraftPublishPanel({
  initial,
}: {
  initial: DraftRecord;
}) {
  const [draft, setDraft] = useState(initial),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deploymentId, setDeploymentId] = useState('');
  const endpoint = `/admin/api/drafts/${initial.id}/publish`;
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(endpoint, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const p = (await r.json()) as DraftRecord & { error?: string };
      if (!r.ok) throw new Error(p.error);
      setDraft(p);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 조회 실패');
    }
  }, [endpoint]);
  useEffect(() => {
    if (!['pending', 'verifying', 'requesting'].includes(draft.deploy_state))
      return;
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [draft.deploy_state, refresh]);
  const publish = async (action = 'publish') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: initial.version,
          confirmed: draft.state === 'published' ? true : confirmed,
          action,
          deploymentId,
        }),
      });
      const p = (await r.json()) as DraftRecord & { error?: string };
      if (!r.ok) throw new Error(p.error);
      setDraft(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '발행 요청 실패');
    } finally {
      setBusy(false);
    }
  };
  const status: Record<string, string> = {
    idle: '배포 요청 전',
    requesting: '배포 요청 확인 중',
    pending: 'Cloudflare 빌드 중',
    verifying: '빌드 성공 · 운영 주소 확인 중',
    failed: '배포 실패',
    unknown: '요청 결과 확인 필요',
    ready: '운영 공개 확인 완료',
  };
  return (
    <section
      className="admin-draft-publish"
      aria-label="저장된 초안 검토 및 발행"
    >
      <h1>
        저장된 초안 미리보기 <small>버전 {initial.version}</small>
      </h1>
      <p>
        아래 내용은 저장된 버전입니다. 미입력 안내 문구는 발행 내용이 아닙니다.
      </p>
      <output>
        {draftStateLabel[draft.state]} ·{' '}
        {status[draft.deploy_state] || draft.deploy_state}
      </output>
      {draft.missing.length > 0 && (
        <p>발행 전 필요한 항목: {draft.missing.join(', ')}</p>
      )}
      {draft.last_error && <p role="alert">{draft.last_error}</p>}
      {error && <p role="alert">{error}</p>}
      {draft.state !== 'published' && (
        <label className="admin-draft-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          내용·사진을 직접 확인했으며 이 버전을 공개합니다.
        </label>
      )}
      <div className="admin-draft-actions">
        {['writing', 'review'].includes(draft.state) && (
          <a href={`/admin?view=draft&id=${draft.id}`}>초안 수정</a>
        )}
        {['review', 'publishing'].includes(draft.state) && (
          <button
            disabled={busy || !confirmed || draft.missing.length > 0}
            onClick={() => void publish()}
          >
            {draft.state === 'publishing'
              ? '같은 버전 발행 준비 재시도'
              : '이 버전 수동 발행'}
          </button>
        )}
        {draft.state === 'writing' && (
          <span>수정 화면에서 ‘검토 대기로 저장’ 후 발행할 수 있습니다.</span>
        )}
        {draft.state === 'published' && draft.deploy_state === 'idle' && (
          <button
            disabled={busy}
            onClick={() => {
              setConfirmed(true);
              void publish();
            }}
          >
            배포 요청 계속
          </button>
        )}
        {draft.deploy_state === 'failed' && (
          <button
            disabled={busy}
            onClick={() => {
              setConfirmed(true);
              void publish('retry-deploy');
            }}
          >
            같은 사례 배포만 재시도
          </button>
        )}
        {draft.state === 'published' && (
          <button type="button" disabled={busy} onClick={() => void refresh()}>
            상태 다시 확인
          </button>
        )}
        {draft.deploy_state === 'ready' && (
          <a
            href={`https://www.acedentshop.co.kr/works/detail/${draft.published_slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            사례 페이지로 가기 ↗
          </a>
        )}
        <a href="/admin?view=drafts">초안 목록</a>
      </div>
      {['unknown', 'requesting'].includes(draft.deploy_state) && (
        <div className="admin-fields">
          <p>
            배포를 다시 요청하지 않습니다. Cloudflare에서 이번 main 배포 ID를
            확인해 연결하세요. 요청이 없었던 경우에는 운영 점검이 필요합니다.
          </p>
          <label>
            확인한 배포 ID
            <input
              value={deploymentId}
              onChange={(e) => setDeploymentId(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !deploymentId}
            onClick={() => {
              setConfirmed(true);
              void publish('attach');
            }}
          >
            배포 ID 연결
          </button>
        </div>
      )}
    </section>
  );
}
