'use client';

/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Vite SPA: internal anchors and pre-compressed img assets are intentional. */

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type SyntheticEvent,
} from 'react';
import { ArrowLeft, ArrowUpRight, ImagePlus, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import AdminGalleryEditor, { type AdminGalleryItemView } from '@/components/AdminGalleryEditor';
import WorkCard from '@/components/WorkCard';
import WorkClassification from '@/components/WorkClassification';
import WorkPhotoGallery from '@/components/WorkPhotoGallery';
import WorkVehicleTag from '@/components/WorkVehicleTag';
import {
  WORK_GALLERY_MAX_PER_SCOPE,
  WORK_GALLERY_MAX_TOTAL,
  WORK_CATEGORIES,
  WORK_PARTS,
  getWorkCategoryLabel,
  isWorkPart,
  type WorkAssetKind,
  type WorkCategory,
  type WorkGalleryImage,
  type WorkItem,
  type WorkPart,
  type WorkPartValue,
} from '@/content/works/types';
import { getWorkImageAlt } from '@/lib/work-images';
import { getWorkSeoCopy, getWorkSeoWarnings } from '@/lib/work-seo';
import { getWorks } from '@/lib/works';
import { siteUrl } from '@/lib/seo';

interface ProcessedImage {
  blob: Blob;
  preview: string;
  bytes: number;
  width: number;
  height: number;
}

interface ExistingImage {
  key: string;
  preview: string;
  bytes: number;
  width: number;
  height: number;
}

type ImageDraft = ProcessedImage | ExistingImage;
type DeploymentState = 'idle' | 'pending' | 'ready' | 'failed';

interface GalleryDraft {
  id: string;
  image?: ImageDraft;
  thumbnail?: ImageDraft;
  caption: string;
  processing?: boolean;
}

interface PartDraft {
  id: string;
  parts: WorkPart[];
  category: WorkCategory | '';
  customPartEnabled: boolean;
  customPart: string;
  detail: string;
  label: string;
  note: string;
  before?: ImageDraft;
  after?: ImageDraft;
  thumbnail?: ImageDraft;
  gallery: GalleryDraft[];
  processing?: 'before' | 'after';
}

interface UploadedAsset {
  key: string;
  url: string;
}

interface StoredAsset {
  object_key: string;
  public_url: string;
  kind: WorkAssetKind;
  part_index: number;
  bytes: number | null;
  width: number;
  height: number;
}

interface AdminPageProps {
  editSlug?: string;
}

const today = new Date().toISOString().slice(0, 10);

function newPart(): PartDraft {
  return {
    id: crypto.randomUUID(),
    parts: ['범퍼'],
    category: '',
    customPartEnabled: false,
    customPart: '',
    detail: '',
    label: '범퍼',
    note: '',
    gallery: [],
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

function partSelectionCount(part: PartDraft) {
  return part.parts.length + (part.customPartEnabled ? 1 : 0);
}

function composePartLabel(part: Pick<PartDraft, 'parts' | 'customPartEnabled' | 'customPart' | 'detail'>) {
  const names: string[] = [...part.parts];
  if (part.customPartEnabled && part.customPart.trim()) names.push(part.customPart.trim());
  return [names.join(' · '), part.detail.trim()].filter(Boolean).join(' ');
}

function splitPartLabel(label: string, fallback: WorkPartValue[]) {
  const matched = WORK_PARTS.filter((part) => label.includes(part));
  const fallbackFixed = fallback.filter(isWorkPart);
  const customPart = fallback.find((part) => !isWorkPart(part)) || '';
  const parts = [...new Set(fallbackFixed.length || customPart ? fallbackFixed : matched)].slice(0, 3);
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
  return { blob, preview: URL.createObjectURL(blob), bytes: blob.size, width, height };
}

async function processGalleryImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error('이 브라우저에서 사진을 처리할 수 없습니다.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvasBlob(canvas, 200_000);
  return { blob, preview: URL.createObjectURL(blob), bytes: blob.size, width, height };
}

function uploadImage(
  image: ProcessedImage,
  kind: WorkAssetKind,
  uploadId: string,
  partIndex: number,
  onProgress: (value: number) => void,
  name = 'image',
) {
  return new Promise<UploadedAsset>((resolve, reject) => {
    const form = new FormData();
    form.append('file', new File([image.blob], `${kind}.jpg`, { type: 'image/jpeg' }));
    form.append('kind', kind);
    form.append('uploadId', uploadId);
    form.append('partIndex', String(partIndex));
    form.append('name', name);

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
  const [workGallery, setWorkGallery] = useState<GalleryDraft[]>([]);
  const [subCategories, setSubCategories] = useState<WorkCategory[]>([]);
  const [subParts, setSubParts] = useState<WorkPart[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('입력 중');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState('');
  const [slugWarnings, setSlugWarnings] = useState<string[]>([]);
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [deploymentState, setDeploymentState] = useState<DeploymentState>('idle');
  const [dragTarget, setDragTarget] = useState('');
  const [loadingWork, setLoadingWork] = useState(editing);
  const [workLoaded, setWorkLoaded] = useState(!editing);

  useEffect(() => {
    setSubCategories((current) =>
      current.includes(form.category)
        ? current.filter((item) => item !== form.category)
        : current,
    );
  }, [form.category]);

  useEffect(() => {
    const primaryPart = parts[0]?.parts[0];
    if (primaryPart) {
      setSubParts((current) =>
        current.includes(primaryPart as WorkPart)
          ? current.filter((item) => item !== primaryPart)
          : current,
      );
    }
  }, [parts]);

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
        const existingImage = (url: string, label: string): ExistingImage => {
          const asset = assetByUrl.get(url);
          if (!asset) throw new Error(`${label}의 D1 이미지 기록을 찾지 못했습니다.`);
          return {
            key: asset.object_key,
            preview: url,
            bytes: asset.bytes || 0,
            width: asset.width,
            height: asset.height,
          };
        };
        const galleryDrafts = (gallery: readonly WorkGalleryImage[] | undefined, label: string) =>
          (gallery ?? []).map((image, galleryIndex) => ({
            id: crypto.randomUUID(),
            image: existingImage(image.src, `${label} ${galleryIndex + 1}번 원본`),
            thumbnail: existingImage(image.thumbnail || image.src, `${label} ${galleryIndex + 1}번 썸네일`),
            caption: image.caption || '',
          } satisfies GalleryDraft));
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
        setSubCategories(work.subCategories ?? []);
        setSubParts((work.subParts ?? []).filter(isWorkPart).slice(0, 2));
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
            category: media.category ?? '',
            customPartEnabled: parsed.customPartEnabled,
            customPart: parsed.customPart,
            detail: parsed.detail,
            label: media.label,
            note: media.note,
            before: { key: beforeAsset.object_key, preview: media.before, bytes: beforeAsset.bytes || 0, width: beforeAsset.width, height: beforeAsset.height },
            after: { key: afterAsset.object_key, preview: media.after, bytes: afterAsset.bytes || 0, width: afterAsset.width, height: afterAsset.height },
            thumbnail: {
              key: (thumbnailAsset || afterAsset).object_key,
              preview: media.thumbnail || media.after,
              bytes: thumbnailAsset?.bytes || afterAsset.bytes || 0,
              width: (thumbnailAsset || afterAsset).width,
              height: (thumbnailAsset || afterAsset).height,
            },
            gallery: galleryDrafts(media.gallery, `${index + 1}번 PART 추가 사진`),
          } satisfies PartDraft;
        }));
        setWorkGallery(galleryDrafts(work.gallery, '사례 전체 추가 사진'));
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

  const galleryPreview = (gallery: readonly GalleryDraft[]): WorkGalleryImage[] => gallery
    .filter((item): item is GalleryDraft & { image: ImageDraft; thumbnail: ImageDraft } => Boolean(item.image && item.thumbnail))
    .map((item) => ({
      src: item.image.preview,
      thumbnail: item.thumbnail.preview,
      caption: item.caption.trim() || undefined,
      width: item.image.width,
      height: item.image.height,
    }));

  const previewWork = useMemo<WorkItem>(() => ({
    slug: editSlug || 'preview',
    date: form.date,
    title: form.title || '작업 제목 미리보기',
    category: form.category,
    subCategories,
    part: parts[0] ? selectedPartValues(parts[0]).slice(0, 1) : [],
    subParts,
    carMaker: form.carMaker || '차량 제조사',
    carModel: form.carModel,
    color: form.color || '색상',
    parts: parts.map((part) => ({
      part: selectedPartValues(part),
      category: part.category || undefined,
      label: part.label || composePartLabel(part),
      before: part.before?.preview || '',
      after: part.after?.preview || '',
      thumbnail: part.thumbnail?.preview,
      note: part.note || '부위 설명 미리보기',
      gallery: galleryPreview(part.gallery),
    })),
    gallery: galleryPreview(workGallery),
    summary: form.summary || '카드와 상세 페이지에 함께 표시될 요약입니다.',
    body: form.body || '상세 작업 설명이 여기에 표시됩니다.',
    blogUrl: form.blogUrl || undefined,
    featured: false,
    days: form.days || '작업기간',
    sliderType: 'drag',
  }), [editSlug, form, parts, subCategories, subParts, workGallery]);
  const previewSeo = getWorkSeoCopy(previewWork);
  const previewSeoWarnings = form.title.trim()
    ? getWorkSeoWarnings(previewWork, getWorks())
    : [];

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePrimaryCategory = (category: WorkCategory) => {
    updateForm('category', category);
    setSubCategories((current) => current.filter((item) => item !== category));
  };

  const toggleSubCategory = (category: WorkCategory) => {
    setSubCategories((current) => {
      if (current.includes(category)) return current.filter((item) => item !== category);
      if (current.length >= 2 || category === form.category) return current;
      return [...current, category];
    });
  };

  const toggleSubPart = (part: WorkPart) => {
    setSubParts((current) => {
      if (current.includes(part)) return current.filter((item) => item !== part);
      const primaryPart = parts[0]?.parts[0];
      if (current.length >= 2 || part === primaryPart) return current;
      return [...current, part];
    });
  };

  const startNewWork = () => {
    const newWorkPath = '/admin?view=new';
    if (`${window.location.pathname}${window.location.search}` === newWorkPath) {
      window.location.reload();
      return;
    }
    window.location.assign(newWorkPath);
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
    setParts((current) => current.map((item) => {
      if (item.id !== id) return item;
      const selected = item.parts.includes(value);
      if (!selected && partSelectionCount(item) >= 3) return item;
      const next = {
        ...item,
        parts: selected
          ? item.parts.filter((part) => part !== value)
          : [...item.parts, value],
      };
      return { ...next, label: composePartLabel(next) };
    }));
  };

  const toggleCustomPart = (id: string) => {
    setParts((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (!item.customPartEnabled && partSelectionCount(item) >= 3) return item;
      const next = {
        ...item,
        customPartEnabled: !item.customPartEnabled,
        customPart: item.customPartEnabled ? '' : item.customPart,
      };
      return { ...next, label: composePartLabel(next) };
    }));
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

  const galleryTotal = workGallery.length + parts.reduce((count, part) => count + part.gallery.length, 0);

  const processGalleryFile = async (file: File, id: string) => {
    const [image, thumbnail] = await Promise.all([
      processGalleryImage(file),
      processImage(file, 800, 600, 120_000),
    ]);
    return { id, image, thumbnail, caption: '', processing: false } satisfies GalleryDraft;
  };

  const addPartGalleryFiles = async (partId: string, files: File[]) => {
    const part = parts.find((item) => item.id === partId);
    if (!part) return;
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    const limit = Math.min(
      WORK_GALLERY_MAX_PER_SCOPE - part.gallery.length,
      WORK_GALLERY_MAX_TOTAL - galleryTotal,
    );
    if (limit <= 0) {
      setError(`추가 사진은 PART당 ${WORK_GALLERY_MAX_PER_SCOPE}장, 사례 전체 ${WORK_GALLERY_MAX_TOTAL}장까지 등록할 수 있습니다.`);
      return;
    }
    if (accepted.length !== files.length || accepted.length > limit) {
      setError(`이미지 파일만 가능하며 현재 ${limit}장까지 더 추가할 수 있습니다.`);
    } else {
      setError('');
    }
    const selectedFiles = accepted.slice(0, limit);
    const placeholders = selectedFiles.map(() => ({ id: crypto.randomUUID(), caption: '', processing: true } satisfies GalleryDraft));
    setParts((current) => current.map((item) => item.id === partId
      ? { ...item, gallery: [...item.gallery, ...placeholders] }
      : item));
    await Promise.all(selectedFiles.map(async (file, index) => {
      const placeholder = placeholders[index];
      try {
        const draft = await processGalleryFile(file, placeholder.id);
        updatePartGallery(partId, placeholder.id, draft);
      } catch (imageError) {
        removePartGallery(partId, placeholder.id);
        setError(imageError instanceof Error ? imageError.message : '추가 사진 처리에 실패했습니다.');
      }
    }));
  };

  const addWorkGalleryFiles = async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    const limit = Math.min(
      WORK_GALLERY_MAX_PER_SCOPE - workGallery.length,
      WORK_GALLERY_MAX_TOTAL - galleryTotal,
    );
    if (limit <= 0) {
      setError(`추가 사진은 영역당 ${WORK_GALLERY_MAX_PER_SCOPE}장, 사례 전체 ${WORK_GALLERY_MAX_TOTAL}장까지 등록할 수 있습니다.`);
      return;
    }
    if (accepted.length !== files.length || accepted.length > limit) {
      setError(`이미지 파일만 가능하며 현재 ${limit}장까지 더 추가할 수 있습니다.`);
    } else {
      setError('');
    }
    const selectedFiles = accepted.slice(0, limit);
    const placeholders = selectedFiles.map(() => ({ id: crypto.randomUUID(), caption: '', processing: true } satisfies GalleryDraft));
    setWorkGallery((current) => [...current, ...placeholders]);
    await Promise.all(selectedFiles.map(async (file, index) => {
      const placeholder = placeholders[index];
      try {
        const draft = await processGalleryFile(file, placeholder.id);
        setWorkGallery((current) => current.map((item) => item.id === placeholder.id ? draft : item));
      } catch (imageError) {
        setWorkGallery((current) => current.filter((item) => item.id !== placeholder.id));
        setError(imageError instanceof Error ? imageError.message : '추가 사진 처리에 실패했습니다.');
      }
    }));
  };

  const updatePartGallery = (partId: string, galleryId: string, patch: Partial<GalleryDraft>) => {
    setParts((current) => current.map((part) => part.id === partId
      ? { ...part, gallery: part.gallery.map((item) => item.id === galleryId ? { ...item, ...patch } : item) }
      : part));
  };

  const movePartGallery = (partId: string, galleryId: string, direction: -1 | 1) => {
    setParts((current) => current.map((part) => {
      if (part.id !== partId) return part;
      const index = part.gallery.findIndex((item) => item.id === galleryId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= part.gallery.length) return part;
      const gallery = [...part.gallery];
      [gallery[index], gallery[nextIndex]] = [gallery[nextIndex], gallery[index]];
      return { ...part, gallery };
    }));
  };

  const removePartGallery = (partId: string, galleryId: string) => {
    setParts((current) => current.map((part) => part.id === partId
      ? { ...part, gallery: part.gallery.filter((item) => item.id !== galleryId) }
      : part));
  };

  const moveWorkGallery = (galleryId: string, direction: -1 | 1) => {
    setWorkGallery((current) => {
      const index = current.findIndex((item) => item.id === galleryId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const gallery = [...current];
      [gallery[index], gallery[nextIndex]] = [gallery[nextIndex], gallery[index]];
      return gallery;
    });
  };

  const galleryView = (gallery: readonly GalleryDraft[]): AdminGalleryItemView[] => gallery.map((item) => ({
    id: item.id,
    preview: item.thumbnail?.preview || item.image?.preview,
    bytes: item.image?.bytes,
    caption: item.caption,
    processing: item.processing,
  }));

  const handleImageDrag = (
    event: DragEvent<HTMLLabelElement>,
    target: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDragTarget(target);
  };

  const handleImageDragLeave = (
    event: DragEvent<HTMLLabelElement>,
    target: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragTarget((current) => (current === target ? '' : current));
  };

  const handleImageDrop = (
    event: DragEvent<HTMLLabelElement>,
    id: string,
    kind: 'before' | 'after',
    target: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget((current) => (current === target ? '' : current));

    const files = [...event.dataTransfer.files];
    if (files.length !== 1) {
      setError('BEFORE와 AFTER 칸에는 사진을 한 장씩 끌어놓아 주세요.');
      return;
    }
    const [file] = files;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 등록할 수 있습니다.');
      return;
    }
    void chooseImage(id, kind, file);
  };

  const pollDeployment = async (
    startedAt: string,
    deploymentId: string | undefined,
    slug: string,
  ) => {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      const query = new URLSearchParams({ since: startedAt, slug });
      if (deploymentId) query.set('deploymentId', deploymentId);
      const response = await fetch(`/admin/api/deploy?${query.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
      const payload = await response.json() as { status?: string; url?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || '배포 상태를 확인하지 못했습니다.');
      if (payload.status === 'success') {
        setStatus('배포 완료');
        setDeploymentUrl(payload.url || '');
        setDeploymentState('ready');
        return;
      }
      if (payload.status === 'verifying') setStatus('배포 콘텐츠 확인 중');
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
    setSavedSlug('');
    setSlugWarnings([]);
    setDeploymentUrl('');
    setDeploymentState('idle');
    try {
      if (parts.some((part) => {
        const count = selectedPartValues(part).length;
        return count < 1 || count > 3;
      })) throw new Error('각 사진 묶음의 작업 부위를 1개 이상 3개 이하로 선택하세요.');
      if (subCategories.length > 2 || subParts.length > 2) throw new Error('보조 작업과 보조 부위는 각각 최대 2개까지 선택할 수 있습니다.');
      if (parts.some((part) => part.customPartEnabled && !part.customPart.trim())) throw new Error('기타 부위명을 직접 입력하세요.');
      if (parts.some((part) => !part.before || !part.after || !part.thumbnail)) throw new Error('모든 부위의 전·후 사진을 선택하세요.');
      const allGalleries = [...parts.flatMap((part) => part.gallery), ...workGallery];
      if (parts.some((part) => part.gallery.length > WORK_GALLERY_MAX_PER_SCOPE) || workGallery.length > WORK_GALLERY_MAX_PER_SCOPE) {
        throw new Error(`추가 사진은 각 영역에 최대 ${WORK_GALLERY_MAX_PER_SCOPE}장까지 등록할 수 있습니다.`);
      }
      if (allGalleries.length > WORK_GALLERY_MAX_TOTAL) {
        throw new Error(`추가 사진은 사례 전체 최대 ${WORK_GALLERY_MAX_TOTAL}장까지 등록할 수 있습니다.`);
      }
      if (allGalleries.some((item) => !item.image || !item.thumbnail || item.processing)) {
        throw new Error('추가 사진 처리가 끝날 때까지 잠시 기다려 주세요.');
      }
      const uploadId = crypto.randomUUID();
      const total = parts.reduce((count, part) => count + [part.before, part.after, part.thumbnail]
        .filter((image): image is ImageDraft => Boolean(image))
        .filter(isProcessedImage).length
        + part.gallery.reduce((galleryCount, item) => galleryCount
          + [item.image, item.thumbnail]
            .filter((image): image is ImageDraft => Boolean(image))
            .filter(isProcessedImage).length, 0), 0)
        + workGallery.reduce((count, item) => count
          + [item.image, item.thumbnail]
            .filter((image): image is ImageDraft => Boolean(image))
            .filter(isProcessedImage).length, 0);
      let completed = 0;
      setStatus(total > 0 ? '사진 업로드 중' : '사례 저장 중');
      if (total === 0) setProgress(100);

      const uploadedParts = [];
      for (const [partIndex, part] of parts.entries()) {
        const upload = async (image: ImageDraft, kind: WorkAssetKind, name = 'image') => {
          if (!isProcessedImage(image)) return { key: image.key, url: image.preview };
          const result = await uploadImage(image, kind, uploadId, partIndex, (fraction) => {
            setProgress(total > 0 ? Math.round(((completed + fraction) / total) * 100) : 100);
          }, name);
          completed += 1;
          setProgress(total > 0 ? Math.round((completed / total) * 100) : 100);
          return result;
        };
        const gallery = [];
        for (const [galleryIndex, item] of part.gallery.entries()) {
          gallery.push({
            image: await upload(item.image!, 'gallery', `gallery-${galleryIndex + 1}-${item.id}`),
            thumbnail: await upload(item.thumbnail!, 'gallery-thumbnail', `gallery-${galleryIndex + 1}-${item.id}`),
            caption: item.caption.trim() || undefined,
          });
        }
        uploadedParts.push({
          part: selectedPartValues(part),
          category: part.category || undefined,
          detail: part.detail,
          label: part.label,
          note: part.note,
          before: await upload(part.before!, 'before'),
          after: await upload(part.after!, 'after'),
          thumbnail: await upload(part.thumbnail!, 'thumbnail'),
          gallery,
        });
      }

      const uploadedWorkGallery = [];
      for (const [galleryIndex, item] of workGallery.entries()) {
        const upload = async (image: ImageDraft, kind: WorkAssetKind) => {
          if (!isProcessedImage(image)) return { key: image.key, url: image.preview };
          const result = await uploadImage(image, kind, uploadId, 20, (fraction) => {
            setProgress(total > 0 ? Math.round(((completed + fraction) / total) * 100) : 100);
          }, `gallery-${galleryIndex + 1}-${item.id}`);
          completed += 1;
          setProgress(total > 0 ? Math.round((completed / total) * 100) : 100);
          return result;
        };
        uploadedWorkGallery.push({
          image: await upload(item.image!, 'gallery'),
          thumbnail: await upload(item.thumbnail!, 'gallery-thumbnail'),
          caption: item.caption.trim() || undefined,
        });
      }

      setStatus('사례 저장 중');
      const savePath = editing ? `/admin/api/works/${encodeURIComponent(editSlug!)}` : '/admin/api/works';
      const saveResponse = await fetch(savePath, {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subCategories, subParts, uploadId, parts: uploadedParts, gallery: uploadedWorkGallery }),
      });
      const saved = await saveResponse.json() as { work?: WorkItem; cleanupPending?: number; slugWarnings?: string[]; error?: string };
      if (!saveResponse.ok || !saved.work) throw new Error(saved.error || `사례 ${editing ? '수정' : '저장'}에 실패했습니다.`);
      setSavedSlug(saved.work.slug);
      setSlugWarnings(saved.slugWarnings || []);
      setDeploymentState('pending');

      setStatus('Cloudflare 빌드 요청 중');
      const deployResponse = await fetch('/admin/api/deploy', { method: 'POST', credentials: 'same-origin' });
      const deployment = await deployResponse.json() as {
        startedAt?: string;
        deploymentId?: string;
        error?: string;
      };
      if (!deployResponse.ok || !deployment.startedAt) throw new Error(deployment.error || '배포 요청에 실패했습니다.');
      await pollDeployment(deployment.startedAt, deployment.deploymentId, saved.work.slug);
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
      setDeploymentState((current) => (current === 'pending' ? 'failed' : current));
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
              <label>차종 <small>선택</small><input value={form.carModel} onChange={(e) => updateForm('carModel', e.target.value)} placeholder="예: 파나메라" /></label>
              <label>색상<input required={!editing} value={form.color} onChange={(e) => updateForm('color', e.target.value)} placeholder="예: 화이트 계열" /></label>
              <label>카테고리<select value={form.category} onChange={(e) => updatePrimaryCategory(e.target.value as WorkCategory)}>{WORK_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
              <label>작업기간<input required value={form.days} onChange={(e) => updateForm('days', e.target.value)} placeholder="예: 2일" /></label>
              <label>작업 완료일<input type="date" required value={form.date} onChange={(e) => updateForm('date', e.target.value)} /></label>
            </div>
            <fieldset className="admin-part-picker admin-secondary-picker">
              <legend>보조 작업 <small>선택 · 최대 2개</small></legend>
              <div className="admin-part-toggles">
                {WORK_CATEGORIES.filter((item) => item.id !== form.category).map((item) => (
                  <button
                    type="button"
                    className={subCategories.includes(item.id) ? 'is-active' : ''}
                    aria-pressed={subCategories.includes(item.id)}
                    disabled={!subCategories.includes(item.id) && subCategories.length >= 2}
                    onClick={() => toggleSubCategory(item.id)}
                    key={item.id}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
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
                      <legend>{index === 0 ? '주 PART 부위' : '사진 부위'} <small>{index === 0 ? '첫 선택이 주 부위 · 최대 3개' : '복수 선택 · 최대 3개'}</small></legend>
                      <div className="admin-part-toggles">
                        {WORK_PARTS.map((item) => <button type="button" className={part.parts.includes(item) ? 'is-active' : ''} aria-pressed={part.parts.includes(item)} disabled={!part.parts.includes(item) && partSelectionCount(part) >= 3} onClick={() => togglePartName(part.id, item)} key={item}>{item}</button>)}
                        <button type="button" className={part.customPartEnabled ? 'is-active' : ''} aria-pressed={part.customPartEnabled} disabled={!part.customPartEnabled && partSelectionCount(part) >= 3} onClick={() => toggleCustomPart(part.id)}>기타(직접 입력)</button>
                      </div>
                      {part.customPartEnabled && <input required value={part.customPart} onChange={(e) => updatePartName(part.id, { customPart: e.target.value })} maxLength={30} placeholder="예: 쿼터패널" aria-label="기타 부위명" />}
                    </fieldset>
                    <div className="admin-fields">
                      <label>PART 작업 방식 <small>실제로 작업한 경우만 선택</small>
                        <select value={part.category} onChange={(e) => updatePart(part.id, { category: e.target.value as WorkCategory | '' })}>
                          <option value="">선택 안 함</option>
                          {WORK_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                        </select>
                      </label>
                      <label>세부 위치<input value={part.detail} onChange={(e) => updatePartName(part.id, { detail: e.target.value })} placeholder="예: 후면, 옆면" /></label>
                    </div>
                  </div>
                  {index === 0 && (
                    <fieldset className="admin-part-picker admin-secondary-picker">
                      <legend>보조 부위 <small>선택 · 최대 2개</small></legend>
                      <div className="admin-part-toggles">
                        {WORK_PARTS.filter((item) => item !== part.parts[0]).map((item) => (
                          <button
                            type="button"
                            className={subParts.includes(item) ? 'is-active' : ''}
                            aria-pressed={subParts.includes(item)}
                            disabled={!subParts.includes(item) && subParts.length >= 2}
                            onClick={() => toggleSubPart(item)}
                            key={item}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <label>부위 설명<textarea required rows={2} maxLength={300} value={part.note} onChange={(e) => updatePart(part.id, { note: e.target.value })} placeholder="실제 손상과 작업 내용을 입력하세요." /></label>
                  <div className="admin-image-pair">
                    {(['before', 'after'] as const).map((kind) => {
                      const selected = part[kind];
                      const dropTarget = `${part.id}:${kind}`;
                      const dragging = dragTarget === dropTarget;
                      return <div className="admin-image-slot" key={kind}>
                        <label
                          className={`admin-image-input${selected ? ' has-image' : ''}${dragging ? ' is-dragging' : ''}`}
                          onDragEnter={(event) => handleImageDrag(event, dropTarget)}
                          onDragOver={(event) => handleImageDrag(event, dropTarget)}
                          onDragLeave={(event) => handleImageDragLeave(event, dropTarget)}
                          onDrop={(event) => handleImageDrop(event, part.id, kind, dropTarget)}
                        >
                          <input type="file" accept="image/*" capture="environment" onChange={(event) => {
                            void chooseImage(part.id, kind, event.currentTarget.files?.[0]);
                            event.currentTarget.value = '';
                          }} />
                          {selected ? <img src={selected.preview} alt={`${part.label || '작업 부위'} ${kind === 'before' ? '작업 전' : '작업 후'} 미리보기`} width="1600" height="1200" /> : <ImagePlus aria-hidden="true" />}
                          <strong>{kind === 'before' ? 'BEFORE' : 'AFTER'}</strong>
                          <span>{dragging ? '여기에 놓으세요' : part.processing === kind ? '사진 처리 중…' : selected ? `${selected.bytes ? `${Math.ceil(selected.bytes / 1024)}KB` : '현재 이미지'} · 다시 선택하거나 끌어놓기` : '촬영·갤러리 선택 / PC는 끌어놓기'}</span>
                        </label>
                        {selected && <button type="button" className="admin-clear-image" onClick={() => clearImage(part.id, kind)} aria-label={`${part.label || '작업 부위'} ${kind === 'before' ? '작업 전' : '작업 후'} 이미지 삭제`}><X aria-hidden="true" /> 이미지 삭제</button>}
                      </div>;
                    })}
                  </div>
                  <AdminGalleryEditor
                    title="PART 추가 사진"
                    description="전·후 비교 외에 가까운 손상, 작업 과정, 마감 상태를 보충합니다. 원본 비율은 유지됩니다."
                    items={galleryView(part.gallery)}
                    maxItems={WORK_GALLERY_MAX_PER_SCOPE}
                    availableSlots={Math.max(0, WORK_GALLERY_MAX_TOTAL - galleryTotal)}
                    onFiles={(files) => { void addPartGalleryFiles(part.id, files); }}
                    onCaptionChange={(galleryId, caption) => updatePartGallery(part.id, galleryId, { caption })}
                    onMove={(galleryId, direction) => movePartGallery(part.id, galleryId, direction)}
                    onRemove={(galleryId) => removePartGallery(part.id, galleryId)}
                  />
                </fieldset>
              ))}
            </div>
            <button className="admin-add-part" type="button" onClick={() => setParts((current) => [...current, newPart()])}><Plus aria-hidden="true" /> 작업 부위 추가</button>
            <AdminGalleryEditor
              title="사례 전체 추가 사진"
              description="특정 PART에 속하지 않는 차량 전체 모습, 입고·출고 사진 등을 등록합니다."
              items={galleryView(workGallery)}
              maxItems={WORK_GALLERY_MAX_PER_SCOPE}
              availableSlots={Math.max(0, WORK_GALLERY_MAX_TOTAL - galleryTotal)}
              onFiles={(files) => { void addWorkGalleryFiles(files); }}
              onCaptionChange={(galleryId, caption) => setWorkGallery((current) => current.map((item) => item.id === galleryId ? { ...item, caption } : item))}
              onMove={moveWorkGallery}
              onRemove={(galleryId) => setWorkGallery((current) => current.filter((item) => item.id !== galleryId))}
            />
            <p className="admin-gallery-limit">추가 사진은 PART별·전체 영역별 최대 {WORK_GALLERY_MAX_PER_SCOPE}장, 사례 한 건에 총 {WORK_GALLERY_MAX_TOTAL}장까지 등록됩니다.</p>
          </section>

          <section className="admin-submit-panel">
            <div><span>{status}</span>{saving && <progress value={progress} max="100">{progress}%</progress>}<small>{saving ? `${progress}%` : '저장하면 Cloudflare 빌드가 자동으로 시작됩니다.'}</small></div>
            <button type="submit" disabled={saving}><UploadCloud aria-hidden="true" />{saving ? `${editing ? '수정' : '등록'} 진행 중` : `사례 ${editing ? '수정' : '저장'} 및 배포`}</button>
            {error && <p role="alert">{error}</p>}
            {slugWarnings.length > 0 && (
              <p className="admin-slug-warning" role="status">
                사전에 없는 단어가 제외되었습니다: {slugWarnings.join(', ')}
              </p>
            )}
            {savedSlug && deploymentState === 'pending' && (
              <p className="admin-deploy-pending" role="status">배포 중... (약 1~2분)</p>
            )}
            {savedSlug && deploymentState === 'failed' && (
              <p className="admin-deploy-pending" role="status">사례는 저장됐지만 배포 상태 확인이 필요합니다.</p>
            )}
            {savedSlug && (deploymentState === 'pending' || deploymentState === 'failed') && (
              <button className="admin-new-work-disabled" type="button" disabled>
                <Plus aria-hidden="true" /> 새 사례 등록
              </button>
            )}
            {savedSlug && deploymentState === 'ready' && (
              <div className="admin-deploy-links">
                <div className="admin-deploy-actions">
                  <a
                    className="admin-result-link"
                    href={`${siteUrl}/works/detail/${encodeURIComponent(savedSlug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    사례 페이지로 가기 <ArrowUpRight aria-hidden="true" />
                  </a>
                  <button className="admin-secondary-action" type="button" onClick={startNewWork}>
                    <Plus aria-hidden="true" /> 새 사례 등록
                  </button>
                  <a
                    className="admin-secondary-action"
                    href="/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    관리 페이지 <ArrowUpRight aria-hidden="true" />
                  </a>
                </div>
                {deploymentUrl && (
                  <a className="admin-deploy-log" href={deploymentUrl} target="_blank" rel="noopener noreferrer">
                    배포 로그 <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </section>
        </form>

        <aside className="admin-preview" aria-label="등록 미리보기">
          <div className="admin-preview-heading"><span>PREVIEW</span><strong>실제 스타일 미리보기</strong></div>
          <div className="admin-card-preview">
            {previewWork.parts[0]?.after ? <WorkCard work={previewWork} /> : <div className="admin-preview-empty">대표 AFTER 사진을 선택하면 카드가 표시됩니다.</div>}
          </div>
          <article className="work-detail admin-detail-preview">
            <header className="work-detail-heading">
              <WorkClassification work={previewWork} />
              <h1>{previewWork.title}</h1>
              <div className="work-detail-meta"><WorkVehicleTag maker={previewWork.carMaker} model={previewWork.carModel} /><span>{previewWork.part[0]}</span>{previewWork.subParts.map((part) => <span className="work-detail-secondary-part" key={part}>{part}</span>)}<span>{previewWork.color}</span><strong>{previewWork.days}</strong></div>
            </header>
            <div className="work-detail-parts">
              {previewWork.parts.map((part, index) => <section className="work-detail-part" key={`${part.label}-${index}`}>
                <header className="work-detail-part-heading"><span>PART {String(index + 1).padStart(2, '0')}{part.category && ` · ${getWorkCategoryLabel(part.category)}`}</span><h2>{part.label}</h2><p>{part.note}</p></header>
                {part.before && part.after ? <div className="work-detail-slider"><BeforeAfterSlider beforeSrc={part.before} afterSrc={part.after} beforeAlt={getWorkImageAlt(previewWork, part, '전')} afterAlt={getWorkImageAlt(previewWork, part, '후')} mode="drag" /></div> : <div className="admin-preview-empty">전·후 사진을 선택하면 비교 슬라이더가 표시됩니다.</div>}
                {part.gallery && part.gallery.length > 0 && <WorkPhotoGallery images={part.gallery} work={previewWork} part={part} title="해당 부위 사진 더 보기" compact />}
              </section>)}
            </div>
            <div className="work-detail-copy"><p className="work-detail-summary">{previewWork.summary}</p><p>{previewWork.body}</p></div>
            {previewWork.gallery && previewWork.gallery.length > 0 && <WorkPhotoGallery images={previewWork.gallery} work={previewWork} label="MORE PHOTOS" title="사례 사진 더 보기" />}
          </article>
          <dl className="admin-seo-preview">
            <div><dt>자동 제목</dt><dd>{previewSeo.title}</dd></div>
            <div><dt>자동 설명</dt><dd>{previewSeo.description}</dd></div>
            {previewSeoWarnings.length > 0 && (
              <div className="admin-seo-warnings">
                <dt>확인 안내</dt>
                <dd><ul>{previewSeoWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </main>
  );
}
