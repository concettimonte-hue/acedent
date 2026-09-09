'use client';

/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA: internal anchors and pre-compressed img assets are intentional. */

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { ArrowLeft, ArrowUpRight, ImagePlus, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import WorkCard from '@/components/WorkCard';
import {
  WORK_CATEGORIES,
  WORK_PARTS,
  getWorkCategoryLabel,
  isWorkPart,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
  type WorkPartValue,
} from '@/content/works/types';
import { getWorkImageAlt } from '@/lib/work-images';
import { getWorkSeoCopy } from '@/lib/work-seo';
import { formatWorkCar } from '@/lib/works';

interface ProcessedImage {
  blob: Blob;
  preview: string;
  bytes: number;
}

interface ExistingImage {
  key: string;
  preview: string;
  bytes: number;
}

type ImageDraft = ProcessedImage | ExistingImage;

interface PartDraft {
  id: string;
  parts: WorkPart[];
  customPartEnabled: boolean;
  customPart: string;
  detail: string;
  label: string;
  note: string;
  before?: ImageDraft;
  after?: ImageDraft;
  thumbnail?: ImageDraft;
  processing?: 'before' | 'after';
}

interface UploadedAsset {
  key: string;
  url: string;
}

interface StoredAsset {
  object_key: string;
  public_url: string;
  kind: 'before' | 'after' | 'thumbnail';
  part_index: number;
  bytes: number | null;
}

interface AdminPageProps {
  editSlug?: string;
}

const today = new Date().toISOString().slice(0, 10);

function newPart(): PartDraft {
  return {
    id: crypto.randomUUID(),
    parts: ['범퍼'],
    customPartEnabled: false,
    customPart: '',
    detail: '',
    label: '범퍼',
    note: '',
  };
}

function isProcessedImage(image: ImageDraft): image is ProcessedImage {
  return 'blob' in image;
}

function selectedPartValues(part: PartDraft): WorkPartValue[] {
  const values: WorkPartValue[] = [...part.parts];
  if (part.customPartEnabled && part.customPart.trim()) values.push(part.customPart.trim());
  return [...new Set(values)];
}

function composePartLabel(part: Pick<PartDraft, 'parts' | 'customPartEnabled' | 'customPart' | 'detail'>) {
  const names: string[] = [...part.parts];
  if (part.customPartEnabled && part.customPart.trim()) names.push(part.customPart.trim());
  return [names.join(' · '), part.detail.trim()].filter(Boolean).join(' ');
}

function splitPartLabel(label: string, fallback: WorkPartValue[]) {
  const matched = WORK_PARTS.filter((part) => label.includes(part));
  const fallbackFixed = fallback.filter(isWorkPart);
  const customPart = fallback.find((part) => !isWorkPart(part) && label.includes(part)) || '';
  const parts = [...new Set(matched.length ? matched : fallbackFixed)];
  if (parts.length === 0 && !customPart) parts.push('범퍼');
  const detail = [
    ...parts,
    customPart,
  ].filter(Boolean).reduce((value, part) => value.replace(part, ''), label)
    .replace(/^[\s·_-]+|[\s·_-]+$/g, '')
    .trim();
  return {
    parts,
    customPartEnabled: Boolean(customPart),
    customPart,
    detail,
  };
}

function canvasBlob(canvas: HTMLCanvasElement, maxBytes: number) {
  return new Promise<Blob>((resolve, reject) => {
    const encode = (quality: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('이미지를 변환하지 못했습니다.'));
          if (blob.size <= maxBytes) return resolve(blob);
          if (quality <= 0.1) {
            return reject(new Error('사진을 200KB 이하로 압축하지 못했습니다. 다른 사진을 선택하세요.'));
          }
          encode(Math.max(0.1, quality - 0.06));
        },
        'image/jpeg',
        quality,
      );
    };
    encode(0.88);
  });
}

async function processImage(file: File, width: number, height: number, maxBytes: number) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('이 브라우저에서 사진을 처리할 수 없습니다.');

  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = width / height;
  let sourceWidth = bitmap.width;
  let sourceHeight = bitmap.height;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = bitmap.height * targetRatio;
    sourceX = (bitmap.width - sourceWidth) / 2;
  } else {
    sourceHeight = bitmap.width / targetRatio;
    sourceY = (bitmap.height - sourceHeight) / 2;
  }
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  bitmap.close();
  const blob = await canvasBlob(canvas, maxBytes);
  return { blob, preview: URL.createObjectURL(blob), bytes: blob.size };
}

function uploadImage(
  image: ProcessedImage,
  kind: 'before' | 'after' | 'thumbnail',
  uploadId: string,
  partIndex: number,
  onProgress: (value: number) => void,
) {
  return new Promise<UploadedAsset>((resolve, reject) => {
    const form = new FormData();
    form.append('file', new File([image.blob], `${kind}.jpg`, { type: 'image/jpeg' }));
    form.append('kind', kind);
    form.append('uploadId', uploadId);
    form.append('partIndex', String(partIndex));

    const request = new XMLHttpRequest();
    request.open('POST', '/admin/api/images');
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onerror = () => reject(new Error('사진 업로드 중 네트워크 오류가 발생했습니다.'));
    request.onload = () => {
      try {
        const payload = JSON.parse(request.responseText || '{}') as UploadedAsset & { error?: string };
        if (request.status < 200 || request.status >= 300) return reject(new Error(payload.error || '사진 업로드에 실패했습니다.'));
        resolve(payload);
      } catch {
        reject(new Error('사진 업로드 응답을 확인하지 못했습니다.'));
      }
    };
    request.send(form);
  });
}

export default function AdminPage({ editSlug }: AdminPageProps) {
  const editing = Boolean(editSlug);
  const [form, setForm] = useState({
    date: today,
    carMaker: '',
    carModel: '',
    color: '',
    category: 'panel-paint' as WorkCategory,
    days: '',
    title: '',
    summary: '',
    body: '',
    blogUrl: '',
  });
  const [parts, setParts] = useState<PartDraft[]>([newPart()]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('입력 중');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const [loadingWork, setLoadingWork] = useState(editing);
  const [workLoaded, setWorkLoaded] = useState(!editing);

  useEffect(() => {
    if (!editSlug) return;
    let active = true;
    const load = async () => {
      setLoadingWork(true);
      setError('');
      try {
        const response = await fetch(`/admin/api/works/${encodeURIComponent(editSlug)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const payload = await response.json() as { work?: WorkItem; assets?: StoredAsset[]; error?: string };
        if (!response.ok || !payload.work || !payload.assets) throw new Error(payload.error || '사례 정보를 불러오지 못했습니다.');
        if (!active) return;

        const work = payload.work;
        const assetByUrl = new Map(payload.assets.map((asset) => [asset.public_url, asset]));
        setForm({
          date: work.date,
          carMaker: work.carMaker,
          carModel: work.carModel,
          color: work.color || '',
          category: work.category,
          days: work.days,
          title: work.title,
          summary: work.summary,
          body: work.body,
          blogUrl: work.blogUrl || '',
        });
        setParts(work.parts.map((media, index) => {
          const fallbackParts = media.part?.length
            ? media.part
            : work.parts.length === 1
              ? work.part
              : [work.part[index] || work.part[0] || '범퍼'];
          const parsed = splitPartLabel(media.label, fallbackParts);
          const beforeAsset = assetByUrl.get(media.before);
          const afterAsset = assetByUrl.get(media.after);
          const thumbnailAsset = media.thumbnail ? assetByUrl.get(media.thumbnail) : afterAsset;
          if (!beforeAsset || !afterAsset) throw new Error(`${index + 1}번 부위의 D1 이미지 기록을 찾지 못했습니다.`);
          return {
            id: crypto.randomUUID(),
            parts: parsed.parts,
            customPartEnabled: parsed.customPartEnabled,
            customPart: parsed.customPart,
            detail: parsed.detail,
            label: media.label,
            note: media.note,
            before: { key: beforeAsset.object_key, preview: media.before, bytes: beforeAsset.bytes || 0 },
            after: { key: afterAsset.object_key, preview: media.after, bytes: afterAsset.bytes || 0 },
            thumbnail: {
              key: (thumbnailAsset || afterAsset).object_key,
              preview: media.thumbnail || media.after,
              bytes: thumbnailAsset?.bytes || afterAsset.bytes || 0,
            },
          } satisfies PartDraft;
        }));
        setWorkLoaded(true);
        setStatus('수정 중');
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : '사례 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoadingWork(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [editSlug]);

  const previewWork = useMemo<WorkItem>(() => ({
    slug: 'preview',
    date: form.date,
    title: form.title || '작업 제목 미리보기',
    category: form.category,
    part: [...new Set(parts.flatMap(selectedPartValues))],
    carMaker: form.carMaker || '차량 제조사',
    carModel: form.carModel || '차종',
    color: form.color || '색상',
    parts: parts.map((part) => ({
      part: selectedPartValues(part),
      label: part.label || composePartLabel(part),
      before: part.before?.preview || '',
      after: part.after?.preview || '',
      thumbnail: part.thumbnail?.preview,
      note: part.note || '부위 설명 미리보기',
    })),
    summary: form.summary || '카드와 상세 페이지에 함께 표시될 요약입니다.',
    body: form.body || '상세 작업 설명이 여기에 표시됩니다.',
    blogUrl: form.blogUrl || undefined,
    featured: false,
    days: form.days || '작업기간',
    sliderType: 'drag',
  }), [form, parts]);
  const previewSeo = getWorkSeoCopy(previewWork);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePart = (id: string, patch: Partial<PartDraft>) => {
    setParts((current) => current.map((part) => (part.id === id ? { ...part, ...patch } : part)));
  };

  const updatePartName = (
    id: string,
    patch: Partial<Pick<PartDraft, 'parts' | 'customPartEnabled' | 'customPart' | 'detail'>>,
  ) => {
    setParts((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      return { ...next, label: composePartLabel(next) };
    }));
  };

  const togglePartName = (id: string, value: WorkPart) => {
    const current = parts.find((part) => part.id === id);
    if (!current) return;
    const nextParts = current.parts.includes(value)
      ? current.parts.filter((part) => part !== value)
      : [...current.parts, value];
    updatePartName(id, { parts: nextParts });
  };

  const clearImage = (id: string, kind: 'before' | 'after') => {
    setParts((current) => current.map((part) => {
      if (part.id !== id) return part;
      return kind === 'after'
        ? { ...part, after: undefined, thumbnail: undefined }
        : { ...part, before: undefined };
    }));
  };

  const chooseImage = async (id: string, kind: 'before' | 'after', file?: File) => {
    if (!file) return;
    setError('');
    updatePart(id, { processing: kind });
    try {
      const main = await processImage(file, 1600, 1200, 200_000);
      if (kind === 'before') {
        updatePart(id, { before: main, processing: undefined });
      } else {
        const thumbnail = await processImage(file, 800, 600, 120_000);
        updatePart(id, { after: main, thumbnail, processing: undefined });
      }
    } catch (imageError) {
      updatePart(id, { processing: undefined });
      setError(imageError instanceof Error ? imageError.message : '사진 처리에 실패했습니다.');
    }
  };

  const pollDeployment = async (startedAt: string) => {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      const response = await fetch(`/admin/api/deploy?since=${encodeURIComponent(startedAt)}`, { cache: 'no-store', credentials: 'same-origin' });
      const payload = await response.json() as { status?: string; url?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || '배포 상태를 확인하지 못했습니다.');
      if (payload.status === 'success') {
        setStatus('배포 완료');
        setSavedUrl(payload.url || '');
        return;
      }
      if (payload.status === 'failure') throw new Error('Cloudflare 빌드가 실패했습니다. 대시보드 빌드 로그를 확인하세요.');
      setStatus(payload.status === 'waiting' ? '빌드 대기 중' : 'Cloudflare 빌드 중');
    }
    throw new Error('배포 확인 시간이 초과됐습니다. Cloudflare 대시보드에서 상태를 확인하세요.');
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    setProgress(0);
    setSavedUrl('');
    try {
      if (parts.some((part) => selectedPartValues(part).length === 0)) throw new Error('각 사진 묶음의 부위를 한 개 이상 선택하세요.');
      if (parts.some((part) => part.customPartEnabled && !part.customPart.trim())) throw new Error('기타 부위명을 직접 입력하세요.');
      if (parts.some((part) => !part.before || !part.after || !part.thumbnail)) throw new Error('모든 부위의 전·후 사진을 선택하세요.');
      const uploadId = crypto.randomUUID();
      const total = parts.reduce((count, part) => count + [part.before, part.after, part.thumbnail]
        .filter((image): image is ImageDraft => Boolean(image))
        .filter(isProcessedImage).length, 0);
      let completed = 0;
      setStatus(total > 0 ? '사진 업로드 중' : '사례 저장 중');
      if (total === 0) setProgress(100);

      const uploadedParts = [];
      for (const [partIndex, part] of parts.entries()) {
        const upload = async (image: ImageDraft, kind: 'before' | 'after' | 'thumbnail') => {
          if (!isProcessedImage(image)) return { key: image.key, url: image.preview };
          const result = await uploadImage(image, kind, uploadId, partIndex, (fraction) => {
            setProgress(total > 0 ? Math.round(((completed + fraction) / total) * 100) : 100);
          });
          completed += 1;
          setProgress(total > 0 ? Math.round((completed / total) * 100) : 100);
          return result;
        };
        uploadedParts.push({
          part: selectedPartValues(part),
          detail: part.detail,
          label: part.label,
          note: part.note,
          before: await upload(part.before!, 'before'),
          after: await upload(part.after!, 'after'),
          thumbnail: await upload(part.thumbnail!, 'thumbnail'),
        });
      }

      setStatus('사례 저장 중');
      const savePath = editing ? `/admin/api/works/${encodeURIComponent(editSlug!)}` : '/admin/api/works';
      const saveResponse = await fetch(savePath, {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, uploadId, parts: uploadedParts }),
      });
      const saved = await saveResponse.json() as { work?: WorkItem; cleanupPending?: number; error?: string };
      if (!saveResponse.ok || !saved.work) throw new Error(saved.error || `사례 ${editing ? '수정' : '저장'}에 실패했습니다.`);

      setStatus('Cloudflare 빌드 요청 중');
      const deployResponse = await fetch('/admin/api/deploy', { method: 'POST', credentials: 'same-origin' });
      const deployment = await deployResponse.json() as { startedAt?: string; error?: string };
      if (!deployResponse.ok || !deployment.startedAt) throw new Error(deployment.error || '배포 요청에 실패했습니다.');
      await pollDeployment(deployment.startedAt);
      if (editing && saved.cleanupPending) {
        setStatus('교체 이미지 정리 준비 중');
        const releaseResponse = await fetch('/admin/api/orphans', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ releaseWorkSlug: editSlug }),
        });
        const released = await releaseResponse.json() as { released?: number; error?: string };
        if (!releaseResponse.ok) throw new Error(released.error || '교체 이미지 정리 준비에 실패했습니다.');
        setStatus(`수정 및 배포 완료 · 교체 전 이미지 ${released.released || 0}개는 관리 목록에서 수동 정리하세요.`);
      }
    } catch (submitError) {
      setStatus('확인 필요');
      setError(submitError instanceof Error ? submitError.message : `${editing ? '수정' : '등록'} 중 오류가 발생했습니다.`);
    } finally {
      setSaving(false);
    }
  };

  if (editing && !workLoaded) {
    return (
      <main className="admin-page">
        <header className="admin-header">
          <a href="/admin" aria-label="수리사례 관리 목록">ACE DENT</a>
          <div><span>ADMIN</span><strong>수리사례 수정</strong></div>
        </header>
        <section className="admin-list-shell">
          <div className={`admin-list-empty${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>
            {loadingWork ? '사례 정보를 불러오는 중입니다.' : error}
          </div>
          {!loadingWork && <a className="admin-back-link" href="/admin"><ArrowLeft aria-hidden="true" /> 관리 목록으로</a>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/admin" aria-label="수리사례 관리 목록">ACE DENT</a>
        <div><span>ADMIN</span><strong>수리사례 {editing ? '수정' : '등록'}</strong></div>
      </header>

      <div className="admin-layout">
        <form className="admin-form" onSubmit={submit}>
          <section className="admin-panel">
            <div className="admin-panel-heading"><span>01</span><h1>차량과 작업 정보</h1></div>
            <div className="admin-fields admin-fields-two">
              <label>차량 제조사<input required value={form.carMaker} onChange={(e) => updateForm('carMaker', e.target.value)} placeholder="예: 포르쉐" /></label>
              <label>차종<input required value={form.carModel} onChange={(e) => updateForm('carModel', e.target.value)} placeholder="예: 파나메라" /></label>
              <label>색상<input required={!editing} value={form.color} onChange={(e) => updateForm('color', e.target.value)} placeholder="예: 화이트 계열" /></label>
              <label>카테고리<select value={form.category} onChange={(e) => updateForm('category', e.target.value)}>{WORK_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
              <label>작업기간<input required value={form.days} onChange={(e) => updateForm('days', e.target.value)} placeholder="예: 2일" /></label>
              <label>작업 완료일<input type="date" required value={form.date} onChange={(e) => updateForm('date', e.target.value)} /></label>
            </div>
            <div className="admin-fields">
              <label>제목<input required maxLength={80} value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="예: 뒤범퍼 비탈거 전체도색" /></label>
              <label>요약<textarea required maxLength={300} rows={3} value={form.summary} onChange={(e) => updateForm('summary', e.target.value)} placeholder="카드와 상세 첫 문단에 함께 표시됩니다." /></label>
              <label>상세 설명<textarea required rows={7} value={form.body} onChange={(e) => updateForm('body', e.target.value)} placeholder="확인한 손상과 실제 진행한 작업만 입력하세요." /></label>
              <label>블로그 링크 <small>선택</small><input type="url" value={form.blogUrl} onChange={(e) => updateForm('blogUrl', e.target.value)} placeholder="https://blog.naver.com/..." /></label>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading"><span>02</span><h2>부위별 전후 사진</h2></div>
            <p className="admin-help">사진 방향을 바로잡고 4:3으로 맞춘 뒤 1600×1200, 200KB 이하로 자동 처리합니다.</p>
            <div className="admin-parts">
              {parts.map((part, index) => (
                <fieldset className="admin-part" key={part.id}>
                  <legend>PART {String(index + 1).padStart(2, '0')}</legend>
                  {parts.length > 1 && <button type="button" className="admin-remove" onClick={() => setParts((current) => current.filter((item) => item.id !== part.id))}><Trash2 aria-hidden="true" /> 삭제</button>}
                  <div className="admin-fields admin-fields-two">
                    <fieldset className="admin-part-picker">
                      <legend>부위명 <small>여러 개 선택 가능</small></legend>
                      <div className="admin-part-toggles">
                        {WORK_PARTS.map((item) => <button type="button" className={part.parts.includes(item) ? 'is-active' : ''} aria-pressed={part.parts.includes(item)} onClick={() => togglePartName(part.id, item)} key={item}>{item}</button>)}
                        <button type="button" className={part.customPartEnabled ? 'is-active' : ''} aria-pressed={part.customPartEnabled} onClick={() => updatePartName(part.id, { customPartEnabled: !part.customPartEnabled, customPart: part.customPartEnabled ? '' : part.customPart })}>기타(직접 입력)</button>
                      </div>
                      {part.customPartEnabled && <input required value={part.customPart} onChange={(e) => updatePartName(part.id, { customPart: e.target.value })} maxLength={30} placeholder="예: 쿼터패널" aria-label="기타 부위명" />}
                    </fieldset>
                    <label>세부 위치<input value={part.detail} onChange={(e) => updatePartName(part.id, { detail: e.target.value })} placeholder="예: 후면, 옆면" /></label>
                  </div>
                  <label>부위 설명<textarea required rows={2} maxLength={300} value={part.note} onChange={(e) => updatePart(part.id, { note: e.target.value })} placeholder="실제 손상과 작업 내용을 입력하세요." /></label>
                  <div className="admin-image-pair">
                    {(['before', 'after'] as const).map((kind) => {
                      const selected = part[kind];
                      return <div className="admin-image-slot" key={kind}>
                        <label className={`admin-image-input${selected ? ' has-image' : ''}`}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => chooseImage(part.id, kind, e.target.files?.[0])} />
                          {selected ? <img src={selected.preview} alt={`${part.label || '작업 부위'} ${kind === 'before' ? '작업 전' : '작업 후'} 미리보기`} width="1600" height="1200" /> : <ImagePlus aria-hidden="true" />}
                          <strong>{kind === 'before' ? 'BEFORE' : 'AFTER'}</strong>
                          <span>{part.processing === kind ? '사진 처리 중…' : selected ? `${selected.bytes ? `${Math.ceil(selected.bytes / 1024)}KB` : '현재 이미지'} · 다시 선택` : '촬영 또는 갤러리 선택'}</span>
                        </label>
                        {selected && <button type="button" className="admin-clear-image" onClick={() => clearImage(part.id, kind)} aria-label={`${part.label || '작업 부위'} ${kind === 'before' ? '작업 전' : '작업 후'} 이미지 삭제`}><X aria-hidden="true" /> 이미지 삭제</button>}
                      </div>;
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <button className="admin-add-part" type="button" onClick={() => setParts((current) => [...current, newPart()])}><Plus aria-hidden="true" /> 작업 부위 추가</button>
          </section>

          <section className="admin-submit-panel">
            <div><span>{status}</span>{saving && <progress value={progress} max="100">{progress}%</progress>}<small>{saving ? `${progress}%` : '저장하면 Cloudflare 빌드가 자동으로 시작됩니다.'}</small></div>
            <button type="submit" disabled={saving}><UploadCloud aria-hidden="true" />{saving ? `${editing ? '수정' : '등록'} 진행 중` : `사례 ${editing ? '수정' : '저장'} 및 배포`}</button>
            {error && <p role="alert">{error}</p>}
            {savedUrl && <a href={savedUrl} target="_blank" rel="noopener noreferrer">배포 결과 보기 <ArrowUpRight aria-hidden="true" /></a>}
          </section>
        </form>

        <aside className="admin-preview" aria-label="등록 미리보기">
          <div className="admin-preview-heading"><span>PREVIEW</span><strong>실제 스타일 미리보기</strong></div>
          <div className="admin-card-preview">
            {previewWork.parts[0]?.after ? <WorkCard work={previewWork} /> : <div className="admin-preview-empty">대표 AFTER 사진을 선택하면 카드가 표시됩니다.</div>}
          </div>
          <article className="work-detail admin-detail-preview">
            <header className="work-detail-heading">
              <p>{getWorkCategoryLabel(previewWork.category)}</p>
              <h1>{previewWork.title}</h1>
              <div><span>{formatWorkCar(previewWork)}</span><span>{previewWork.part.join(' · ')}</span><span>{previewWork.color}</span><strong>{previewWork.days}</strong></div>
            </header>
            <div className="work-detail-parts">
              {previewWork.parts.map((part, index) => <section className="work-detail-part" key={`${part.label}-${index}`}>
                <header className="work-detail-part-heading"><span>PART {String(index + 1).padStart(2, '0')}</span><h2>{part.label}</h2><p>{part.note}</p></header>
                {part.before && part.after ? <div className="work-detail-slider"><BeforeAfterSlider beforeSrc={part.before} afterSrc={part.after} beforeAlt={getWorkImageAlt(previewWork, part, '전')} afterAlt={getWorkImageAlt(previewWork, part, '후')} mode="drag" /></div> : <div className="admin-preview-empty">전·후 사진을 선택하면 비교 슬라이더가 표시됩니다.</div>}
              </section>)}
            </div>
            <div className="work-detail-copy"><p className="work-detail-summary">{previewWork.summary}</p><p>{previewWork.body}</p></div>
          </article>
          <dl className="admin-seo-preview"><div><dt>자동 제목</dt><dd>{previewSeo.title}</dd></div><div><dt>자동 설명</dt><dd>{previewSeo.description}</dd></div></dl>
        </aside>
      </div>
    </main>
  );
}
