'use client';
/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA routes and authenticated pre-compressed images are intentional. */
import { useCallback, useEffect, useState } from 'react';
import { draftImageUrl } from '@/lib/work-drafts';
import {
  canDeleteDraft,
  canEditDraft,
  draftListGroup,
  draftListStatus,
  groupDrafts,
  publishedDraftLinks,
  type DraftListGroup,
  type DraftListRecord,
} from '@/lib/draft-list';

export function AdminDraftRow({
  draft: d,
  busy,
  onRemove,
}: {
  draft: DraftListRecord;
  busy: boolean;
  onRemove: (draft: DraftListRecord) => void;
}) {
  const image = d.payload.parts[0]?.before || d.payload.parts[0]?.after;
  const completed = draftListGroup(d) === 'completed';
  const links = publishedDraftLinks(d);
  const id = encodeURIComponent(d.id);
  return (
    <article className="admin-draft-row">
      {image ? (
        <img
          src={draftImageUrl(d.id, image.key)}
          alt={completed ? '발행 당시 대표 사진' : '초안 대표 사진'}
          loading="lazy"
        />
      ) : (
        <div className="admin-draft-no-photo">사진 미입력</div>
      )}
      <div>
        <small>
          {draftListStatus(d)} · 버전 {d.version}
        </small>
        <h2>{d.payload.title || '제목 미입력'}</h2>
        <p>
          {[d.payload.carMaker, d.payload.carModel].filter(Boolean).join(' ') ||
            '차량 미입력'}
        </p>
        <time dateTime={d.updated_at}>
          기록 갱신: {new Date(d.updated_at).toLocaleString('ko-KR')}
        </time>
        {!completed && d.missing.length > 0 && (
          <p>미완성: {d.missing.join(', ')}</p>
        )}
        {d.last_error && <p>{d.last_error}</p>}
        {completed && !links && (
          <p className="admin-draft-link-notice">
            현재 공개 사례와의 연결을 확인할 수 없습니다. 삭제되었거나 비공개
            상태일 수 있습니다. 발행 기록과 사진은 보관되어 있습니다.
          </p>
        )}
      </div>
      <div className="admin-draft-actions">
        {completed ? (
          <>
            {links ? (
              <>
                <a
                  href={links.public}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  공개 글 보기 ↗
                </a>
                <a href={links.edit}>공개 글 수정</a>
              </>
            ) : (
              <a href="/admin">공개 사례 관리</a>
            )}
            <a
              className="admin-draft-history-link"
              href={`/admin?view=draft-preview&id=${id}`}
            >
              발행 당시 원본·기록
            </a>
          </>
        ) : (
          <>
            <a href={`/admin?view=draft-preview&id=${id}`}>검토·미리보기</a>
            {canEditDraft(d) && (
              <a href={`/admin?view=draft&id=${id}`}>이어서 작성</a>
            )}
            {canDeleteDraft(d) && (
              <button disabled={busy} onClick={() => onRemove(d)}>
                초안 삭제
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default function AdminDraftsList() {
  const [drafts, setDrafts] = useState<DraftListRecord[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [loaded, setLoaded] = useState(false),
    [group, setGroup] = useState<DraftListGroup>('progress');
  const groups = groupDrafts(drafts);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/admin/api/drafts', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = (await r.json()) as {
        drafts: DraftListRecord[];
        error?: string;
      };
      if (!r.ok) throw new Error(data.error);
      setDrafts(data.drafts);
      setLoaded(true);
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
  const remove = async (d: DraftListRecord) => {
    if (!canDeleteDraft(d)) return;
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
        <fieldset className="admin-draft-filters">
          <legend className="sr-only">초안 목록 구분</legend>
          {(
            [
              ['progress', '진행 중'],
              ['completed', '발행 완료'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={group === value}
              aria-controls="admin-draft-results"
              onClick={() => setGroup(value)}
            >
              {label} <span>{loaded ? groups[value].length : '—'}</span>
            </button>
          ))}
        </fieldset>
        <p className="admin-draft-list-note">
          {group === 'progress'
            ? '작성·검토 중이거나 배포 확인이 남은 초안입니다. 배포 실패·상태 불명도 여기에 표시됩니다.'
            : '운영 공개가 확인된 발행 이력입니다. 이곳의 제목·사진은 발행 당시 기록이며, 이후 변경은 공개 글에서 확인·수정하세요.'}
        </p>
        {error && <p role="alert">{error}</p>}
        {busy && <output>처리 중…</output>}
        <div id="admin-draft-results" aria-busy={busy}>
          {!busy && !error && (
            <output className="admin-draft-list-note">
              {groups[group].length
                ? `${group === 'progress' ? '진행 중' : '발행 완료'} ${groups[group].length}건`
                : group === 'progress'
                  ? '진행 중인 초안이 없습니다. 새 초안을 작성하거나 발행 완료 기록을 확인하세요.'
                  : '발행 완료 기록이 없습니다. 운영 공개 확인을 마친 사례가 여기에 표시됩니다.'}
            </output>
          )}
          {groups[group].map((d) => (
            <AdminDraftRow
              key={d.id}
              draft={d}
              busy={busy}
              onRemove={(item) => void remove(item)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
