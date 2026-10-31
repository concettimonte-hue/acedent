'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vite SPA routes are intentional. */
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { VISIT_SOURCES, VISIT_BASES, ENTRY_PAGE_TYPES, entryPageType, type VisitAcquisition, type VisitSource, type VisitBasis } from '@/lib/visit-acquisition';
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
  const pageGroups = Object.entries(ENTRY_PAGE_TYPES).map(([type, label]) => ({
    label, entries: pages.filter(page => entryPageType(page.path) === type).reduce((sum, page) => sum + page.entries, 0),
  })).filter(group => group.entries > 0);
  const timeGroups = Array.from({ length: 6 }, (_, index) => ({
    label: `${String(index * 4).padStart(2, '0')}–${String(index * 4 + 3).padStart(2, '0')}시`,
    entries: (data?.hours || []).filter(row => (!selected || row.source === selected) && Math.floor(row.hour / 4) === index).reduce((sum, row) => sum + row.entries, 0),
  }));
  const bases = new Map<VisitBasis, number>();
  for (const row of data?.evidence?.rows || []) {
    if (!selected || row.source === selected) bases.set(row.basis, (bases.get(row.basis) || 0) + row.entries);
  }

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
          {selected === 'after-call-sms' && <p>문자 전용 링크로 시작한 방문입니다. 문자 발송·열람 수나 상담 완료 수는 아닙니다.</p>}
          {selected === 'direct' && <p className="admin-acquisition-explanation">상세사례로 바로 들어와도 검색 유입으로 확정할 수 없습니다. 출처가 없으면 직접 입력·저장한 링크·앱 공유 등을 구분할 수 없습니다.</p>}
          {selected === 'naver-other' && <p>네이버 앱·기타 네이버 출처입니다. 검색 결과를 클릭했다는 뜻은 아닙니다.</p>}
          <div className="admin-acquisition-breakdown">
            <h4>어떤 페이지로 들어왔나요?</h4>
            <dl>{pageGroups.map(group => <div key={group.label}><dt>{group.label}</dt><dd>{group.entries}회 <small>{percent(group.entries, selectedTotal)}</small></dd></div>)}</dl>
            {data.hours && <>
              <h4>방문 시작 시간대 <small>한국시간 · 선택 기간 합계</small></h4>
              <dl className="admin-acquisition-hours">{timeGroups.map(group => <div key={group.label}><dt>{group.label}</dt><dd>{group.entries}회</dd></div>)}</dl>
            </>}
            <details key={selected || 'all'} open={selected === 'direct'}>
              <summary>출처 판별 근거 보기</summary>
              {!data.evidence?.available
                ? <p>{data.evidence?.error === 'unavailable' ? '판별 근거를 불러오지 못했습니다. 기존 유입 통계는 표시합니다.' : '세부 판별 근거 수집 준비 중입니다. 기존 기록의 출처는 소급해 추정하지 않습니다.'}</p>
                : <>
                  <dl>{[...bases].sort((a, b) => b[1] - a[1]).map(([basis, entries]) => <div key={basis}><dt>{VISIT_BASES[basis]}</dt><dd>{entries}회</dd></div>)}</dl>
                  <p>‘판별 근거 미수집’은 도입 전 또는 이전 버전의 기록입니다. ‘출처 정보 없음’과 다르며, 과거 유입을 다시 분류하지 않습니다.</p>
                </>}
            </details>
          </div>
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
