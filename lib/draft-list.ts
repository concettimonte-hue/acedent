import { draftStateLabel, type DraftRecord } from './work-drafts';

/** List-only read projection. A historical published_slug alone is not a live link. */
export interface DraftListRecord extends DraftRecord {
  published_work_slug: string | null;
}
export type DraftListGroup = 'progress' | 'completed';

export function draftListGroup(draft: DraftRecord): DraftListGroup {
  return draft.deploy_state === 'ready' ? 'completed' : 'progress';
}

export function groupDrafts(drafts: DraftListRecord[]) {
  const groups: Record<DraftListGroup, DraftListRecord[]> = {
    progress: [],
    completed: [],
  };
  for (const draft of drafts) groups[draftListGroup(draft)].push(draft);
  return groups;
}

export function draftListStatus(draft: DraftRecord): string {
  if (draftListGroup(draft) === 'completed') return '운영 공개 확인 기록';
  const statuses: Record<string, string> = {
    requesting: '배포 요청 확인 중',
    pending: '배포 중',
    verifying: '운영 반영 확인 중',
    failed: '배포 실패 · 확인 필요',
    unknown: '배포 상태 확인 필요',
  };
  return statuses[draft.deploy_state] || draftStateLabel[draft.state];
}

export function publishedDraftLinks(draft: DraftListRecord) {
  const slug = draft.published_slug;
  if (
    draftListGroup(draft) !== 'completed' ||
    !slug ||
    draft.published_work_slug !== slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    return null;
  return {
    public: `https://www.acedentshop.co.kr/works/detail/${encodeURIComponent(slug)}`,
    edit: `/admin?view=edit&slug=${encodeURIComponent(slug)}`,
  };
}

export function canEditDraft(draft: DraftRecord) {
  return (
    draftListGroup(draft) === 'progress' &&
    ['writing', 'review'].includes(draft.state)
  );
}

export function canDeleteDraft(draft: DraftRecord) {
  return (
    draftListGroup(draft) === 'progress' &&
    ['writing', 'review', 'deleting'].includes(draft.state)
  );
}
