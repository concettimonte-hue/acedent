'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vite SPA routes are intentional. */
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { VISIT_SOURCES, type VisitAcquisition, type VisitSource } from '@/lib/visit-acquisition';
import { analyticsDate } from '@/lib/admin-analytics';

export default function AdminAcquisitionPanel({ data }: { data?: VisitAcquisition }) {
  const [source, setSource] = useState<VisitSource | ''>('');
  const [limit, setLimit] = useState(10);
  const sources = useMemo(() => {
    const totals = new Map<VisitSource, number>();
    for (const row of data?.rows || []) totals.set(row.source, (totals.get(row.source) || 0) + row.entries);
    return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data]);
  const selected = source && sources.some(([key]) => key === source) ? source : '';
  const pages = useMemo(() => {
    const totals = new Map<string, { path: string; label: string; entries: number; isPublished: boolean }>();
    for (const row of data?.rows || []) {
      if (selected && row.source !== selected) continue;
      const previous = totals.get(row.path);
      totals.set(row.path, { ...row, entries: (previous?.entries || 0) + row.entries });
    }
    return [...totals.values()].sort((a, b) => b.entries - a.entries || a.path.localeCompare(b.path));
  }, [data, selected]);
  const selectedTotal = pages.reduce((sum, row) => sum + row.entries, 0);
  const percent = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : '—';

  return <section className="admin-analytics-section admin-acquisition" aria-labelledby="analytics-acquisition-heading">
    <header>
      <div><span>TRAFFIC ENTRY</span><h2 id="analytics-acquisition-heading">유입 경로와 처음 연 페이지</h2></div>
      <p>선택한 기간에 시작된 방문 기준입니다.<br />페이지 조회가 30분 이상 없으면 새 방문으로 셉니다.</p>
    </header>
    {!data?.available ? <div className="admin-analytics-empty" role="status">
      {data?.error === 'migration-required' ? '유입 통계 준비 중입니다. 배포 전에 0009 마이그레이션을 적용해야 합니다.' : '유입 통계를 불러오지 못했습니다. 새로고침해 주세요.'} 기존 방문자·페이지 조회 기록은 유지됩니다.
    </div> : <>
      <div className="admin-acquisition-note">
        <strong>{data.total ? `기록된 방문 시작 ${data.total.toLocaleString()}회` : '선택 기간의 유입 기록 없음'}</strong>
        <span>{data.trackingSince ? `${analyticsDate(new Date(data.trackingSince))} 첫 기록부터 수집한 자료입니다. 첫날은 일부 시간만 포함될 수 있습니다.` : '아직 유입 기록이 없습니다.'} 도입 전 기록은 소급해 채우지 않습니다.</span>
        <span>한 사람이 다시 들어오면 여러 회가 될 수 있어 위 방문자 수와 다릅니다. 출처가 전달되지 않은 방문은 ‘직접·출처 확인 불가’로 묶습니다.</span>
      </div>
      {!data.total ? <div className="admin-analytics-empty">선택 기간에 기록된 방문 시작이 없습니다. 도입 전 방문과 이전 버전 페이지의 방문은 포함되지 않습니다.</div> : <div className="admin-acquisition-grid">
        <div className="admin-acquisition-sources">
          <h3>어디서 들어왔나요?</h3>
          <p>출처를 누르면 해당 유입의 첫 페이지를 봅니다.</p>
          <div role="group" aria-label="유입 출처">
            {([['', data.total], ...sources] as Array<[VisitSource | '', number]>).map(([key, entries]) => <button
              type="button" key={key || 'all'} aria-pressed={selected === key} className={selected === key ? 'is-active' : ''}
              onClick={() => { setSource(key); setLimit(10); }}>
              <span>{key ? VISIT_SOURCES[key] : '전체 유입'}</span>
              <strong>{entries.toLocaleString()}회 <small>{percent(entries, data.total)}</small></strong>
            </button>)}
          </div>
        </div>
        <div className="admin-acquisition-landings" aria-live="polite">
          <h3>{selected ? VISIT_SOURCES[selected] : '전체 유입'} · 처음 연 페이지</h3>
          <p>첫 페이지 이후에 본 페이지는 아래 페이지 목록에서 확인합니다.</p>
          <ol>
            {pages.slice(0, limit).map((page, index) => <li key={page.path}>
              <span className="admin-analytics-rank">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{page.label}</strong><code>{page.path}</code>{!page.isPublished && <small>현재 비공개 또는 삭제된 사례</small>}</div>
              <p><strong>{page.entries.toLocaleString()}회</strong><small>{percent(page.entries, selectedTotal)}</small></p>
              {page.isPublished && <a href={page.path} target="_blank" rel="noopener noreferrer" aria-label={`${page.label} 첫 페이지 새 탭에서 보기`}><ExternalLink aria-hidden="true" /></a>}
            </li>)}
          </ol>
          {pages.length > limit && <button type="button" className="admin-acquisition-more" onClick={() => setLimit((value) => value + 10)}>첫 페이지 더 보기 ({limit}/{pages.length})</button>}
        </div>
      </div>}
      <p className="admin-acquisition-footnote">출처는 브라우저가 전달한 정보와 알려진 링크 표식을 이용한 분류입니다. 광고 표식은 실제 광고 성과를 증명하지 않으며, 검색어·전체 유입 주소·광고 식별자 원문은 수집하지 않습니다.</p>
    </>}
  </section>;
}
