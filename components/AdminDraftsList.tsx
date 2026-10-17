'use client';
/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA routes and authenticated pre-compressed images are intentional. */
import { useCallback, useEffect, useState } from 'react';
import {
  draftImageUrl,
  draftStateLabel,
  type DraftRecord,
} from '@/lib/work-drafts';

export default function AdminDraftsList() {
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/admin/api/drafts', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = (await r.json()) as {
        drafts: DraftRecord[];
        error?: string;
      };
      if (!r.ok) throw new Error(data.error);
      setDrafts(data.drafts);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const remove = async (d: DraftRecord) => {
    if (
      !window.confirm(
        '이 초안과 비공개 사진을 삭제할까요? 공개 사례와 다른 초안은 삭제하지 않습니다.',
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch(`/admin/api/drafts/${d.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: d.version }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/admin">ACE DENT</a>
        <div>
          <span>PRIVATE DRAFTS</span>
          <strong>초안·검토 목록</strong>
        </div>
      </header>
      <section className="admin-drafts-list">
        <div className="admin-draft-actions">
          <a href="/admin?view=new">새 초안 작성</a>
          <a href="/admin">공개 사례 관리</a>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load();
            }}
          >
            새로고침
          </button>
        </div>
        <p>
          관리자 전용입니다. 임시저장과 검토 대기 전환은 사이트를 배포하지
          않습니다.
        </p>
        {error && <p role="alert">{error}</p>}
        {busy && <output>처리 중…</output>}
        {!busy && !error && !drafts.length && <p>저장된 초안이 없습니다.</p>}
        {drafts.map((d) => {
          const image = d.payload.parts[0]?.before || d.payload.parts[0]?.after;
          return (
            <article className="admin-draft-row" key={d.id}>
              {image ? (
                <img
                  src={draftImageUrl(d.id, image.key)}
                  alt="초안 대표 사진"
                  loading="lazy"
                />
              ) : (
                <div className="admin-draft-no-photo">사진 미입력</div>
              )}
              <div>
                <small>
                  {d.deploy_state === 'ready'
                    ? '운영 공개 확인'
                    : draftStateLabel[d.state]}{' '}
                  · 버전 {d.version}
                </small>
                <h2>{d.payload.title || '제목 미입력'}</h2>
                <p>
                  {[d.payload.carMaker, d.payload.carModel]
                    .filter(Boolean)
                    .join(' ') || '차량 미입력'}
                </p>
                <time dateTime={d.updated_at}>
                  {new Date(d.updated_at).toLocaleString('ko-KR')}
                </time>
                {d.missing.length > 0 && <p>미완성: {d.missing.join(', ')}</p>}
                {d.last_error && <p>{d.last_error}</p>}
              </div>
              <div className="admin-draft-actions">
                <a href={`/admin?view=draft-preview&id=${d.id}`}>
                  검토·미리보기
                </a>
                {['writing', 'review'].includes(d.state) && (
                  <a href={`/admin?view=draft&id=${d.id}`}>이어서 작성</a>
                )}
                {['writing', 'review', 'deleting'].includes(d.state) && (
                  <button disabled={busy} onClick={() => void remove(d)}>
                    초안 삭제
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
