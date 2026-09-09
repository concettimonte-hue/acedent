'use client';

/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA: internal anchors and pre-compressed img assets are intentional. */

import { useMemo, useState, type SyntheticEvent } from 'react';
import { ArrowUpRight, ImagePlus, Plus, Trash2, UploadCloud } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import WorkCard from '@/components/WorkCard';
import {
  WORK_CATEGORIES,
  WORK_PARTS,
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
} from '@/content/works/types';
import { getWorkImageAlt } from '@/lib/work-images';
import { getWorkSeoCopy } from '@/lib/work-seo';
import { formatWorkCar } from '@/lib/works';

interface ProcessedImage {
  blob: Blob;
  preview: string;
  bytes: number;
}

interface PartDraft {
  id: string;
  part: WorkPart;
  detail: string;
  note: string;
  before?: ProcessedImage;
  after?: ProcessedImage;
  thumbnail?: ProcessedImage;
  processing?: 'before' | 'after';
}

interface UploadedAsset {
  key: string;
  url: string;
}

const today = new Date().toISOString().slice(0, 10);

function newPart(): PartDraft {
  return { id: crypto.randomUUID(), part: '범퍼', detail: '', note: '' };
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

export default function AdminPage() {
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

  const previewWork = useMemo<WorkItem>(() => ({
    slug: 'preview',
    date: form.date,
    title: form.title || '작업 제목 미리보기',
    category: form.category,
    part: [...new Set(parts.map((part) => part.part))],
    carMaker: form.carMaker || '차량 제조사',
    carModel: form.carModel || '차종',
    color: form.color || '색상',
    parts: parts.map((part) => ({
      label: [part.part, part.detail].filter(Boolean).join(' '),
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
      if (parts.some((part) => !part.before || !part.after || !part.thumbnail)) throw new Error('모든 부위의 전·후 사진을 선택하세요.');
      const uploadId = crypto.randomUUID();
      const total = parts.length * 3;
      let completed = 0;
      setStatus('사진 업로드 중');

      const uploadedParts = [];
      for (const [partIndex, part] of parts.entries()) {
        const upload = async (image: ProcessedImage, kind: 'before' | 'after' | 'thumbnail') => {
          const result = await uploadImage(image, kind, uploadId, partIndex, (fraction) => {
            setProgress(Math.round(((completed + fraction) / total) * 100));
          });
          completed += 1;
          setProgress(Math.round((completed / total) * 100));
          return result;
        };
        uploadedParts.push({
          part: part.part,
          detail: part.detail,
          note: part.note,
          before: await upload(part.before!, 'before'),
          after: await upload(part.after!, 'after'),
          thumbnail: await upload(part.thumbnail!, 'thumbnail'),
        });
      }

      setStatus('사례 저장 중');
      const saveResponse = await fetch('/admin/api/works', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, uploadId, parts: uploadedParts }),
      });
      const saved = await saveResponse.json() as { work?: WorkItem; error?: string };
      if (!saveResponse.ok || !saved.work) throw new Error(saved.error || '사례 저장에 실패했습니다.');

      setStatus('Cloudflare 빌드 요청 중');
      const deployResponse = await fetch('/admin/api/deploy', { method: 'POST', credentials: 'same-origin' });
      const deployment = await deployResponse.json() as { startedAt?: string; error?: string };
      if (!deployResponse.ok || !deployment.startedAt) throw new Error(deployment.error || '배포 요청에 실패했습니다.');
      await pollDeployment(deployment.startedAt);
    } catch (submitError) {
      setStatus('확인 필요');
      setError(submitError instanceof Error ? submitError.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/admin" aria-label="수리사례 관리 목록">ACE DENT</a>
        <div><span>ADMIN</span><strong>수리사례 등록</strong></div>
      </header>

      <div className="admin-layout">
        <form className="admin-form" onSubmit={submit}>
          <section className="admin-panel">
            <div className="admin-panel-heading"><span>01</span><h1>차량과 작업 정보</h1></div>
            <div className="admin-fields admin-fields-two">
              <label>차량 제조사<input required value={form.carMaker} onChange={(e) => updateForm('carMaker', e.target.value)} placeholder="예: 포르쉐" /></label>
              <label>차종<input required value={form.carModel} onChange={(e) => updateForm('carModel', e.target.value)} placeholder="예: 파나메라" /></label>
              <label>색상<input required value={form.color} onChange={(e) => updateForm('color', e.target.value)} placeholder="예: 화이트 계열" /></label>
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
                    <label>부위명<select value={part.part} onChange={(e) => updatePart(part.id, { part: e.target.value as WorkPart })}>{WORK_PARTS.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
                    <label>세부 위치<input value={part.detail} onChange={(e) => updatePart(part.id, { detail: e.target.value })} placeholder="예: 후면, 옆면" /></label>
                  </div>
                  <label>부위 설명<textarea required rows={2} maxLength={300} value={part.note} onChange={(e) => updatePart(part.id, { note: e.target.value })} placeholder="실제 손상과 작업 내용을 입력하세요." /></label>
                  <div className="admin-image-pair">
                    {(['before', 'after'] as const).map((kind) => {
                      const selected = part[kind];
                      return <label className={`admin-image-input${selected ? ' has-image' : ''}`} key={kind}>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => chooseImage(part.id, kind, e.target.files?.[0])} />
                        {selected ? <img src={selected.preview} alt={`${part.part} ${kind === 'before' ? '작업 전' : '작업 후'} 미리보기`} width="1600" height="1200" /> : <ImagePlus aria-hidden="true" />}
                        <strong>{kind === 'before' ? 'BEFORE' : 'AFTER'}</strong>
                        <span>{part.processing === kind ? '사진 처리 중…' : selected ? `${Math.ceil(selected.bytes / 1024)}KB · 다시 선택` : '촬영 또는 갤러리 선택'}</span>
                      </label>;
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <button className="admin-add-part" type="button" onClick={() => setParts((current) => [...current, newPart()])}><Plus aria-hidden="true" /> 작업 부위 추가</button>
          </section>

          <section className="admin-submit-panel">
            <div><span>{status}</span>{saving && <progress value={progress} max="100">{progress}%</progress>}<small>{saving ? `${progress}%` : '저장하면 Cloudflare 빌드가 자동으로 시작됩니다.'}</small></div>
            <button type="submit" disabled={saving}><UploadCloud aria-hidden="true" />{saving ? '등록 진행 중' : '사례 저장 및 배포'}</button>
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
