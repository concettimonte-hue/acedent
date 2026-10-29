import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminBodyEditor from '@/components/AdminBodyEditor';
import AdminPage from '@/components/AdminPage';
import WorkDescription from '@/components/WorkDescription';
import { WORK_BODY_PREFIX, renderWorkBodyHtml } from '@/lib/work-body';
import '@/app/globals.css';

const legacy = '기존 일반 텍스트 설명입니다.\n원문은 그대로 표시됩니다.\n\n별도 서식을 적용하지 않은 두 번째 문단입니다.';
const formatted = WORK_BODY_PREFIX + JSON.stringify([
  ['h', ['확인한 손상']], ['p', ['여기는 ', ['b', '편집기 확인용'], ' 예시입니다. 실제 수리사례가 아닙니다.']],
  ['h', ['작업 내용']], ['ul', [[['p', ['소제목으로 내용을 구분할 수 있습니다.']]], [['p', ['목록은 휴대폰에서도 읽기 쉽게 표시합니다.']]]]],
]);

function Preview() {
  const [value, setValue] = useState(formatted);
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState('');
  const summary = '실제 사례를 바꾸지 않는 로컬 본문 편집기 미리보기';
  const load = (text: string) => { setValue(text); setRevision((v) => v + 1); };
  return <main className="admin-page" style={{ padding: '24px 16px', maxWidth: 1300, margin: 'auto' }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>본문 편집기 · 배포 전 확인</h1>
    <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <button onClick={() => load(legacy)}>일반 본문 예시</button>
      <button onClick={() => load(formatted)}>서식 본문 예시</button>
      <button onClick={() => { setSaved(value); }}>로컬 값 보관</button>
      <button disabled={!saved} onClick={() => load(saved)}>보관한 값 다시 열기</button>
      <a href="/preview/admin">실제 관리자 폼 확인 ↗</a>
    </nav>
    <div className="body-preview-grid">
      <section><AdminBodyEditor key={revision} value={value} summary={summary} onChange={setValue} /></section>
      <section className="admin-detail-preview" style={{ padding: '0 20px' }} aria-label="공개 상세 표시"><WorkDescription summary={summary} body={value} /></section>
    </div>
    <details style={{ marginTop: 24 }}><summary>정적 HTML 본문 확인</summary><div className="work-detail-copy" dangerouslySetInnerHTML={{ __html: renderWorkBodyHtml(value) }} /></details>
    <output data-body-value={value} style={{ display: 'block', marginTop: 16, color: '#aeb3ac', fontSize: 13 }}>로컬 미리보기입니다. 운영 저장·배포는 차단되어 있습니다.</output>
  </main>;
}
const admin = location.pathname === '/preview/admin' || location.pathname === '/admin';
createRoot(document.getElementById('root')!).render(admin ? <AdminPage draftId={new URLSearchParams(location.search).get('id') || undefined} /> : <Preview />);
