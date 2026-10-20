// Synthetic SITE-013 list states only. No production data or credentials.
import { draftFixture, seedDraft } from './draft-test-fixture.mjs';

export async function draftListFixture() {
  const f = draftFixture();
  const cases = [
    ['writing', 'idle', '작성 중 · 사진 보완 예정', null],
    [
      'review',
      'idle',
      '검토 대기 · 긴 제목도 모바일에서 자연스럽게 줄바꿈되는 합성 사례',
      null,
    ],
    ['publishing', 'idle', '발행 준비 중', null],
    ['published', 'idle', '발행 저장 후 배포 요청 전', 'local-idle'],
    ['published', 'requesting', '배포 요청 확인 중', 'local-requesting'],
    ['published', 'pending', '배포 진행 중', 'local-pending'],
    ['published', 'verifying', '운영 반영 확인 중', 'local-verifying'],
    [
      'published',
      'failed',
      '배포 실패 · 기존 재시도 흐름 유지',
      'local-failed',
    ],
    [
      'published',
      'unknown',
      '배포 상태 불명 · 자동 재요청 없음',
      'local-unknown',
    ],
    [
      'published',
      'ready',
      '발행 당시 제목 · 현재 공개 글과 구분',
      'local-published',
    ],
    ['published', 'ready', '공개 사례가 삭제된 발행 기록', 'local-deleted'],
    [
      'published',
      'ready',
      '공개 사례가 삭제 대기인 발행 기록',
      'local-nonpublic',
    ],
    ['published', 'ready', '공개 연결이 없는 발행 기록', null],
    ['deleting', 'idle', '기존 미발행 삭제 진행 상태', null],
  ];
  for (const [i, [state, deployState, title, slug]] of cases.entries()) {
    const { id, payload } = await seedDraft(f, { complete: true, state });
    payload.title = title;
    const date = `2026-10-20T${String(14 - i).padStart(2, '0')}:00:00Z`;
    f.db
      .prepare(
        'UPDATE work_drafts SET payload_json=?,deploy_state=?,published_slug=?,updated_at=?,last_error=? WHERE id=?',
      )
      .run(
        JSON.stringify(payload),
        deployState,
        slug,
        date,
        deployState === 'failed'
          ? '합성 오류: 빌드 실패. 검토 화면에서 확인하세요.'
          : null,
        id,
      );
    if (slug && slug !== 'local-deleted')
      f.db
        .prepare(
          'INSERT INTO works(slug,date,category,payload_json,status,created_by_email,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
        )
        .run(
          slug,
          '2026-10-20',
          'panel-paint',
          JSON.stringify({
            title: '현재 공개 제목 · 발행 당시 원본과 다름',
            slug,
          }),
          slug === 'local-nonpublic' ? 'draft' : 'published',
          'fixture@example.test',
          date,
          date,
        );
  }
  return f;
}
