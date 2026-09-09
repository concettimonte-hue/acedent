'use client';

/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA routes and pre-compressed R2 images are intentional. */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CleanupState {
  status: 'pending' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError: string;
  assetCount: number;
}

interface AdminWorkRow {
  slug: string;
  date: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  carMaker: string;
  carModel: string;
  thumbnail: string;
  cleanup: CleanupState | null;
}

interface ApiError {
  error?: string;
  status?: string;
  attempts?: number;
  maxAttempts?: number;
  startedAt?: string;
  url?: string;
}

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default function AdminWorksList() {
  const [works, setWorks] = useState<AdminWorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<AdminWorkRow | null>(null);
  const [activeSlug, setActiveSlug] = useState('');

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/admin/api/works', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as { works?: AdminWorkRow[]; error?: string };
      if (!response.ok || !payload.works) throw new Error(payload.error || '사례 목록을 불러오지 못했습니다.');
      setWorks(payload.works);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '사례 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  const waitForDeployment = async (startedAt: string) => {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      await delay(4000);
      const response = await fetch(`/admin/api/deploy?since=${encodeURIComponent(startedAt)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as ApiError;
      if (!response.ok) throw new Error(payload.error || '배포 상태를 확인하지 못했습니다.');
      if (payload.status === 'success') return payload.url || '';
      if (payload.status === 'failure') throw new Error('Cloudflare 빌드가 실패했습니다. 이미지와 데이터는 삭제하지 않았습니다.');
      setNotice(payload.status === 'waiting' ? '배포 시작을 기다리는 중입니다.' : '공개 사이트에서 사례를 제거하는 중입니다.');
    }
    throw new Error('배포 확인 시간이 초과됐습니다. 삭제 대기 상태로 보관했습니다.');
  };

  const deployWithoutWork = async () => {
    const response = await fetch('/admin/api/deploy', {
      method: 'POST',
      credentials: 'same-origin',
    });
    const payload = await response.json() as ApiError;
    if (!response.ok || !payload.startedAt) throw new Error(payload.error || '배포 요청에 실패했습니다.');
    return waitForDeployment(payload.startedAt);
  };

  const cleanupAssets = async (workSlug: string, manualRetry = false) => {
    let allowManualReset = manualRetry;
    let lastMessage = '이미지 정리에 실패했습니다.';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch('/admin/api/cleanup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workSlug, manualRetry: allowManualReset }),
      });
      allowManualReset = false;
      const payload = await response.json() as ApiError;
      if (response.ok && payload.status === 'complete') return;
      lastMessage = payload.error || lastMessage;
      if (payload.status === 'failed' || response.status === 409) break;
      if (attempt < 2) await delay(900);
    }
    throw new Error(lastMessage);
  };

  const finishDelete = async (work: AdminWorkRow, options?: { prepare?: boolean; manualRetry?: boolean }) => {
    setActiveSlug(work.slug);
    setError('');
    setNotice('삭제 준비 중입니다.');
    try {
      if (options?.prepare) {
        const response = await fetch(`/admin/api/works/${encodeURIComponent(work.slug)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        const payload = await response.json() as ApiError;
        if (!response.ok) throw new Error(payload.error || '삭제 준비에 실패했습니다.');
      }

      if (!options?.manualRetry) {
        setNotice('공개 사이트 반영을 시작합니다. 완료될 때까지 이미지는 유지됩니다.');
        await deployWithoutWork();
      }

      setNotice('R2 이미지와 D1 사례 데이터를 정리하는 중입니다.');
      await cleanupAssets(work.slug, options?.manualRetry === true);
      setNotice(`‘${work.title}’ 사례를 삭제했습니다.`);
      await loadWorks();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '사례 삭제에 실패했습니다.');
      setNotice('삭제 대기 또는 정리 실패 상태를 목록에 남겼습니다.');
      await loadWorks();
    } finally {
      setActiveSlug('');
    }
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const work = deleteCandidate;
    setDeleteCandidate(null);
    void finishDelete(work, { prepare: true });
  };

  const failedCount = works.filter((work) => work.cleanup?.status === 'failed').length;
  const pendingCount = works.filter((work) => work.cleanup?.status === 'pending').length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" aria-label="에이스덴트 홈페이지">ACE DENT</a>
        <div><span>ADMIN</span><strong>수리사례 관리</strong></div>
      </header>

      <section className="admin-list-shell">
        <div className="admin-list-heading">
          <div>
            <span>WORKS</span>
            <h1>수리사례 관리</h1>
            <p>등록된 사례를 최신순으로 확인하고 중복 사례를 안전하게 삭제할 수 있습니다.</p>
          </div>
          <a href="/admin?view=new"><Plus aria-hidden="true" /> 새 사례 등록</a>
        </div>

        <div className="admin-list-summary" aria-live="polite">
          <div><strong>{works.length}</strong><span>전체 사례</span></div>
          <div><strong>{pendingCount}</strong><span>삭제 대기</span></div>
          <div className={failedCount ? 'has-error' : ''}><strong>{failedCount}</strong><span>정리 실패</span></div>
          <button type="button" onClick={() => void loadWorks()} disabled={loading}><RefreshCw aria-hidden="true" /> 새로고침</button>
        </div>

        {(notice || error) && (
          <div className={`admin-list-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>
            {error && <AlertTriangle aria-hidden="true" />}
            <span>{error || notice}</span>
          </div>
        )}

        {loading ? (
          <div className="admin-list-empty">사례 목록을 불러오는 중입니다.</div>
        ) : works.length === 0 ? (
          <div className="admin-list-empty">등록된 사례가 없습니다.</div>
        ) : (
          <div className="admin-work-list">
            {works.map((work) => {
              const busy = activeSlug === work.slug;
              const cleanup = work.cleanup;
              return (
                <article className={`admin-work-row${cleanup ? ' has-cleanup' : ''}`} key={work.slug}>
                  <div className="admin-work-thumb">
                    {work.thumbnail ? (
                      <img src={work.thumbnail} alt={`${work.carMaker} ${work.carModel} ${work.title} 썸네일`} width="800" height="600" loading="lazy" decoding="async" />
                    ) : <span>NO IMAGE</span>}
                  </div>
                  <div className="admin-work-copy">
                    <span>{work.carMaker} {work.carModel}</span>
                    <h2>{work.title}</h2>
                    <p>등록일 {displayDate(work.createdAt)} · 작업일 {work.date}</p>
                    {cleanup && (
                      <div className={`admin-cleanup-state is-${cleanup.status}`}>
                        <strong>{cleanup.status === 'failed' ? `이미지 정리 실패 ${cleanup.attempts}/${cleanup.maxAttempts}` : `삭제 대기 ${cleanup.attempts}/${cleanup.maxAttempts}`}</strong>
                        <span>{cleanup.status === 'failed' ? (cleanup.lastError || '수동 재시도가 필요합니다.') : `이미지 ${cleanup.assetCount}개가 안전하게 보관되어 있습니다.`}</span>
                      </div>
                    )}
                  </div>
                  <div className="admin-work-actions">
                    <button type="button" disabled title="수정 기능은 다음 단계에서 추가됩니다.">수정</button>
                    {!cleanup && work.status === 'published' && (
                      <button type="button" className="is-delete" disabled={busy} onClick={() => setDeleteCandidate(work)}><Trash2 aria-hidden="true" /> 삭제</button>
                    )}
                    {cleanup?.status === 'pending' && (
                      <button type="button" className="is-finish" disabled={busy} onClick={() => void finishDelete(work)}>{busy ? '처리 중' : '삭제 마무리'} <ArrowRight aria-hidden="true" /></button>
                    )}
                    {cleanup?.status === 'failed' && (
                      <button type="button" className="is-retry" disabled={busy} onClick={() => void finishDelete(work, { manualRetry: true })}>{busy ? '처리 중' : '수동 재시도'} <RefreshCw aria-hidden="true" /></button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={deleteCandidate !== null} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent className="admin-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>이 사례를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate ? `${deleteCandidate.carMaker} ${deleteCandidate.carModel} · ${deleteCandidate.title}` : ''}
              <br />공개 사이트에서 제거한 뒤 연결된 R2 이미지도 함께 삭제합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="admin-dialog-delete" onClick={confirmDelete}>사례 삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
