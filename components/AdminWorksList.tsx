'use client';

/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA routes and pre-compressed R2 images are intentional. */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, HardDrive, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

function formatAdminWorkCar(work: Pick<AdminWorkRow, 'carMaker' | 'carModel'>) {
  return [work.carMaker, work.carModel].filter(Boolean).join(' ');
}

interface ApiError {
  error?: string;
  status?: string;
  attempts?: number;
  maxAttempts?: number;
  startedAt?: string;
  url?: string;
}

interface OrphanFile {
  key: string;
  size: number;
  uploaded: string;
  queue: {
    work_slug: string;
    operation: 'delete-work' | 'replace-asset';
    status: 'pending' | 'failed';
  } | null;
}

interface OrphanResult {
  orphans?: OrphanFile[];
  orphanCount?: number;
  r2ObjectCount?: number;
  referencedCount?: number;
  heldReplacements?: number;
  error?: string;
}

interface AnalyticsResult {
  excluded: boolean;
  trackingSince: string | null;
  stats: {
    todayVisitors: number;
    todayViews: number;
    weekVisitors: number;
    weekViews: number;
    monthVisitors: number;
    monthViews: number;
    allVisitors: number;
    allViews: number;
  };
  daily: Array<{ date: string; visitors: number; views: number }>;
  topPages: Array<{ path: string; visitors: number; views: number }>;
  error?: string;
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
  const [orphans, setOrphans] = useState<OrphanFile[]>([]);
  const [orphanStats, setOrphanStats] = useState({ r2: 0, referenced: 0, held: 0 });
  const [orphanLoading, setOrphanLoading] = useState(true);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);
  const [confirmOrphanDelete, setConfirmOrphanDelete] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

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

  const loadOrphans = useCallback(async () => {
    setOrphanLoading(true);
    try {
      const response = await fetch('/admin/api/orphans', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as OrphanResult;
      if (!response.ok || !payload.orphans) throw new Error(payload.error || '고아 파일을 점검하지 못했습니다.');
      setOrphans(payload.orphans);
      setOrphanStats({
        r2: payload.r2ObjectCount || 0,
        referenced: payload.referencedCount || 0,
        held: payload.heldReplacements || 0,
      });
      setSelectedOrphans((current) => current.filter((key) => payload.orphans!.some((file) => file.key === key)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '고아 파일을 점검하지 못했습니다.');
    } finally {
      setOrphanLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const exclusionResponse = await fetch('/admin/api/analytics', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!exclusionResponse.ok) {
        const exclusionPayload = await exclusionResponse.json() as { error?: string };
        throw new Error(exclusionPayload.error || '관리자 방문 제외 설정에 실패했습니다.');
      }

      const response = await fetch('/admin/api/analytics', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as AnalyticsResult;
      if (!response.ok || !payload.stats) throw new Error(payload.error || '방문 통계를 불러오지 못했습니다.');
      setAnalytics(payload);
    } catch (loadError) {
      setAnalyticsError(loadError instanceof Error ? loadError.message : '방문 통계를 불러오지 못했습니다.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorks();
    void loadOrphans();
    void loadAnalytics();
  }, [loadAnalytics, loadOrphans, loadWorks]);

  const deleteSelectedOrphans = async () => {
    if (selectedOrphans.length === 0) return;
    setConfirmOrphanDelete(false);
    setError('');
    setNotice(`선택한 고아 파일 ${selectedOrphans.length}개를 삭제하는 중입니다.`);
    try {
      const response = await fetch('/admin/api/orphans', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: selectedOrphans }),
      });
      const payload = await response.json() as { deleted?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || '고아 파일 삭제에 실패했습니다.');
      setNotice(`고아 파일 ${payload.deleted || 0}개를 삭제했습니다.`);
      setSelectedOrphans([]);
      await loadOrphans();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '고아 파일 삭제에 실패했습니다.');
    }
  };

  const toggleOrphan = (key: string) => {
    setSelectedOrphans((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

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
            <p>등록된 사례를 수정·삭제하고, D1 기록과 R2 파일의 차이를 직접 점검할 수 있습니다.</p>
          </div>
          <a href="/admin?view=new"><Plus aria-hidden="true" /> 새 사례 등록</a>
        </div>

        <div className="admin-list-summary" aria-live="polite">
          <div><strong>{works.length}</strong><span>전체 사례</span></div>
          <div><strong>{pendingCount}</strong><span>삭제 대기열</span></div>
          <div className={failedCount ? 'has-error' : ''}><strong>{failedCount}</strong><span>대기열 실패</span></div>
          <button type="button" onClick={() => { void loadWorks(); void loadOrphans(); void loadAnalytics(); }} disabled={loading || orphanLoading || analyticsLoading}><RefreshCw aria-hidden="true" /> 새로고침</button>
        </div>

        {(notice || error) && (
          <div className={`admin-list-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>
            {error && <AlertTriangle aria-hidden="true" />}
            <span>{error || notice}</span>
          </div>
        )}

        <section className="admin-analytics-panel" aria-labelledby="analytics-heading">
          <div className="admin-analytics-heading">
            <div>
              <span><BarChart3 aria-hidden="true" /> PRIVATE ANALYTICS</span>
              <h2 id="analytics-heading">방문자 현황</h2>
              <p>Cloudflare Access로 보호된 관리자 전용 통계입니다. 이 브라우저의 방문은 자동으로 제외됩니다.</p>
            </div>
            <button type="button" onClick={() => void loadAnalytics()} disabled={analyticsLoading}><RefreshCw aria-hidden="true" /> 새로고침</button>
          </div>
          {analyticsError ? (
            <div className="admin-analytics-empty is-error" role="alert">{analyticsError}</div>
          ) : analyticsLoading || !analytics ? (
            <div className="admin-analytics-empty">방문 통계를 불러오는 중입니다.</div>
          ) : (
            <>
              <div className="admin-analytics-grid">
                <div><span>오늘</span><strong>{analytics.stats.todayVisitors.toLocaleString()}</strong><small>방문자 · 조회 {analytics.stats.todayViews.toLocaleString()}</small></div>
                <div><span>최근 7일</span><strong>{analytics.stats.weekVisitors.toLocaleString()}</strong><small>방문자 · 조회 {analytics.stats.weekViews.toLocaleString()}</small></div>
                <div><span>최근 30일</span><strong>{analytics.stats.monthVisitors.toLocaleString()}</strong><small>방문자 · 조회 {analytics.stats.monthViews.toLocaleString()}</small></div>
                <div><span>집계 시작 후</span><strong>{analytics.stats.allVisitors.toLocaleString()}</strong><small>방문자 · 조회 {analytics.stats.allViews.toLocaleString()}</small></div>
              </div>
              <div className="admin-analytics-details">
                <div>
                  <strong>최근 30일 많이 본 페이지</strong>
                  {analytics.topPages.length === 0 ? (
                    <p>아직 집계된 방문이 없습니다.</p>
                  ) : (
                    <ol>
                      {analytics.topPages.map((page) => (
                        <li key={page.path}><code>{page.path}</code><span>{page.visitors.toLocaleString()}명 · {page.views.toLocaleString()}회</span></li>
                      ))}
                    </ol>
                  )}
                </div>
                <p>{analytics.trackingSince ? `${analytics.trackingSince}부터 집계` : '배포 후부터 집계 시작'} · 쿠키를 지운 브라우저는 새 방문자로 집계될 수 있습니다.</p>
              </div>
            </>
          )}
        </section>

        <section className="admin-orphan-panel" aria-labelledby="orphan-heading">
          <div className="admin-orphan-heading">
            <div>
              <span><HardDrive aria-hidden="true" /> R2 FILE AUDIT</span>
              <h2 id="orphan-heading">고아 파일 점검</h2>
              <p><code>work_assets</code>에 없는 R2 파일만 표시합니다. 자동 삭제하지 않으며, 선택 후 확인해야 삭제됩니다.</p>
            </div>
            <div className="admin-orphan-count"><strong>{orphanLoading ? '—' : orphans.length}</strong><span>고아 파일</span></div>
          </div>
          <div className="admin-orphan-meta">
            <span>R2 works/ {orphanStats.r2}개</span>
            <span>D1 참조 {orphanStats.referenced}개</span>
            <span>배포 후 분리 대기 {orphanStats.held}개</span>
            <button type="button" onClick={() => void loadOrphans()} disabled={orphanLoading}><RefreshCw aria-hidden="true" /> 다시 점검</button>
          </div>
          {orphanLoading ? (
            <div className="admin-orphan-empty">R2와 D1 키를 비교하는 중입니다.</div>
          ) : orphans.length === 0 ? (
            <div className="admin-orphan-empty">현재 확인된 고아 파일이 없습니다.</div>
          ) : (
            <>
              <div className="admin-orphan-list">
                {orphans.map((file) => (
                  <label key={file.key}>
                    <input type="checkbox" checked={selectedOrphans.includes(file.key)} onChange={() => toggleOrphan(file.key)} />
                    <span><strong>{file.key}</strong><small>{Math.ceil(file.size / 1024)}KB · {displayDate(file.uploaded)}{file.queue ? ' · 정리 대기열 등록됨' : ''}</small></span>
                  </label>
                ))}
              </div>
              <div className="admin-orphan-actions">
                <button type="button" onClick={() => setSelectedOrphans(orphans.map((file) => file.key))}>전체 선택</button>
                <button type="button" onClick={() => setSelectedOrphans([])}>선택 해제</button>
                <button type="button" className="is-delete" disabled={selectedOrphans.length === 0} onClick={() => setConfirmOrphanDelete(true)}><Trash2 aria-hidden="true" /> 선택 {selectedOrphans.length}개 삭제</button>
              </div>
            </>
          )}
        </section>

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
                      <img src={work.thumbnail} alt={`${formatAdminWorkCar(work)} ${work.title} 썸네일`} width="800" height="600" loading="lazy" decoding="async" />
                    ) : <span>NO IMAGE</span>}
                  </div>
                  <div className="admin-work-copy">
                    <span>{formatAdminWorkCar(work)}</span>
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
                    {!cleanup && work.status === 'published' && <a href={`/admin?view=edit&slug=${encodeURIComponent(work.slug)}`}><Pencil aria-hidden="true" /> 수정</a>}
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
              {deleteCandidate ? `${formatAdminWorkCar(deleteCandidate)} · ${deleteCandidate.title}` : ''}
              <br />공개 사이트에서 제거한 뒤 연결된 R2 이미지도 함께 삭제합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="admin-dialog-delete" onClick={confirmDelete}>사례 삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOrphanDelete} onOpenChange={setConfirmOrphanDelete}>
        <AlertDialogContent className="admin-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 고아 파일을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              D1의 어떤 사례에서도 참조하지 않는 R2 파일 {selectedOrphans.length}개를 삭제합니다.
              <br />삭제 직전에 서버가 참조 여부를 다시 확인하며, 삭제 후에는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="admin-dialog-delete" onClick={() => void deleteSelectedOrphans()}>고아 파일 삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
