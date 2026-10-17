import {
  type WorkCategory,
  type WorkImageAnnotation,
  type WorkPartPosition,
  type WorkPartValue,
} from '../content/works/types';

export interface DraftImage {
  key: string;
}
export interface DraftGallery {
  image?: DraftImage;
  thumbnail?: DraftImage;
  caption: string;
}
export interface DraftComparison {
  before?: DraftImage;
  after?: DraftImage;
  caption: string;
  beforeAnnotations: WorkImageAnnotation[];
}
export interface DraftPart {
  part: WorkPartValue[];
  position?: WorkPartPosition;
  category?: WorkCategory;
  detail: string;
  note: string;
  before?: DraftImage;
  after?: DraftImage;
  thumbnail?: DraftImage;
  beforeAnnotations: WorkImageAnnotation[];
  gallery: DraftGallery[];
  comparisons: DraftComparison[];
}
export interface DraftPayload {
  date: string;
  carMaker: string;
  carModel: string;
  color: string;
  category: WorkCategory | '';
  days: string;
  title: string;
  summary: string;
  body: string;
  blogUrl: string;
  subCategories: WorkCategory[];
  subParts: WorkPartValue[];
  parts: DraftPart[];
  gallery: DraftGallery[];
  ogImage?: DraftImage;
}
export interface DraftAsset {
  object_key: string;
  kind: string;
  width: number;
  height: number;
  bytes: number;
  ready: number;
}
export interface DraftRecord {
  id: string;
  state: 'writing' | 'review' | 'publishing' | 'published' | 'deleting';
  version: number;
  payload: DraftPayload;
  assets: DraftAsset[];
  missing: string[];
  updated_at: string;
  published_slug: string | null;
  deploy_state: string;
  deploy_id: string | null;
  last_error: string | null;
}
export const draftImageUrl = (id: string, key: string) =>
  `/admin/api/drafts/${encodeURIComponent(id)}/assets?key=${encodeURIComponent(key)}`;
export function draftMissing(p: DraftPayload): string[] {
  const missing: string[] = [];
  for (const [key, label] of Object.entries({
    date: '작업 완료일',
    carMaker: '제조사',
    color: '색상',
    category: '대표 작업',
    days: '작업기간',
    title: '제목',
    summary: '요약',
    body: '상세 설명',
  })) {
    const value = p[key as keyof DraftPayload];
    if (typeof value !== 'string' || !value.trim()) missing.push(label);
  }
  if (!p.parts.length) missing.push('PART');
  p.parts.forEach((part, i) => {
    if (!part.part.length) missing.push(`PART ${i + 1} 부위`);
    if (!part.before || !part.after || !part.thumbnail)
      missing.push(`PART ${i + 1} 전후 사진`);
    if (!part.note.trim()) missing.push(`PART ${i + 1} 설명`);
    part.comparisons.forEach((pair, j) => {
      if (!pair.before || !pair.after)
        missing.push(`PART ${i + 1} 추가 비교 ${j + 1} 전후 사진`);
    });
  });
  if (
    [...p.gallery, ...p.parts.flatMap((part) => part.gallery)].some(
      (item) => !item.image || !item.thumbnail,
    )
  )
    missing.push('추가 사진 처리');
  if (!p.ogImage) missing.push('첫 PART 전후 공유 이미지');
  return missing;
}
export const draftStateLabel: Record<DraftRecord['state'], string> = {
  writing: '작성 중',
  review: '검토 대기',
  publishing: '발행 준비 중',
  published: '발행 요청됨',
  deleting: '삭제 중',
};
