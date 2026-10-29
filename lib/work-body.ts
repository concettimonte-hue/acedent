/** Versioned, allowlisted body data in the existing string field. Legacy text is never parsed as HTML/Markdown. */
export const WORK_BODY_PREFIX = 'acedent-body:v1\n';
export const WORK_BODY_MAX_LENGTH = 5000;
export type BodyInline = string | ['b', string];
export type BodyBlock = ['p' | 'h', BodyInline[]] | ['ul', BodyBlock[][]];
export interface BodyEditorNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: BodyEditorNode[];
}

function isInline(value: unknown): value is BodyInline {
  return typeof value === 'string' || (Array.isArray(value) && value.length === 2 && value[0] === 'b' && typeof value[1] === 'string');
}

function isBlock(value: unknown, depth = 0): value is BodyBlock {
  if (depth > 12 || !Array.isArray(value) || value.length !== 2 || !Array.isArray(value[1])) return false;
  if (value[0] === 'p' || value[0] === 'h') return value[1].every(isInline);
  return value[0] === 'ul' && value[1].every((item) => Array.isArray(item) && item.length > 0 && item.every((block) => isBlock(block, depth + 1)));
}

export function parseWorkBody(value: string): BodyBlock[] | null {
  if (!value.startsWith(WORK_BODY_PREFIX) || value.length > 100_000) return null;
  try {
    const blocks: unknown = JSON.parse(value.slice(WORK_BODY_PREFIX.length));
    return Array.isArray(blocks) && blocks.every((block) => isBlock(block)) ? blocks : null;
  } catch { return null; }
}

const inlineText = (items: BodyInline[]) => items.map((item) => typeof item === 'string' ? item : item[1]).join('');
const blocksText = (blocks: BodyBlock[]): string => blocks.map((block) => block[0] === 'ul'
  ? block[1].map(blocksText).join('\n') : inlineText(block[1])).join('\n\n');

export function workBodyText(value: string): string {
  const blocks = parseWorkBody(value);
  return blocks ? blocksText(blocks) : value;
}

export function workBodyError(value: string, required = false): string {
  if (value.length > WORK_BODY_MAX_LENGTH) return '상세 설명의 저장 한도(서식 포함 5,000자)를 넘었습니다. 내용을 조금 줄여 주세요.';
  if (value.startsWith(WORK_BODY_PREFIX) && !parseWorkBody(value)) return '상세 설명의 서식을 읽을 수 없습니다. 본문을 확인해 주세요.';
  if (required && !workBodyText(value).trim()) return '상세 설명을 입력하세요.';
  return '';
}

/** New/edited rich bodies are validated; existing plain strings pass through unchanged. */
export function validateWorkBody(value: string, required = false): string {
  const error = workBodyError(value, required);
  if (error) throw new Error(error);
  return value;
}

function editorInlines(items: BodyInline[]): BodyEditorNode[] {
  return items.flatMap((item) => {
    const text = typeof item === 'string' ? item : item[1];
    return text.split('\n').flatMap((line, index) => [
      ...(index ? [{ type: 'hardBreak' }] : []),
      ...(line ? [{ type: 'text', text: line, ...(typeof item === 'string' ? {} : { marks: [{ type: 'bold' }] }) }] : []),
    ]);
  });
}

function editorBlocks(blocks: BodyBlock[]): BodyEditorNode[] {
  return blocks.map((block): BodyEditorNode => block[0] === 'ul'
    ? { type: 'bulletList', content: block[1].map((item) => ({ type: 'listItem', content: editorBlocks(item) })) }
    : { type: block[0] === 'h' ? 'heading' : 'paragraph', ...(block[0] === 'h' ? { attrs: { level: 3 } } : {}), content: editorInlines(block[1]) });
}

export function workBodyToEditorDoc(value: string): BodyEditorNode {
  const blocks = parseWorkBody(value);
  return blocks ? { type: 'doc', content: blocks.length ? editorBlocks(blocks) : [{ type: 'paragraph' }] } : plainTextToEditorDoc(value);
}

export function plainTextToEditorDoc(value: string): BodyEditorNode {
  return { type: 'doc', content: value.split('\n\n').map((paragraph) => ({ type: 'paragraph', content: editorInlines([paragraph]) })) };
}

function compactInlines(nodes: BodyEditorNode[]): BodyInline[] {
  const result: BodyInline[] = [];
  for (const node of nodes) {
    const text = node.type === 'hardBreak' ? '\n' : node.text ?? '';
    if (!text) continue;
    const bold = node.marks?.some((mark) => mark.type === 'bold');
    const previous = result.at(-1);
    if (bold && Array.isArray(previous)) previous[1] += text;
    else if (!bold && typeof previous === 'string') result[result.length - 1] = previous + text;
    else result.push(bold ? ['b', text] : text);
  }
  return result;
}

function compactBlocks(nodes: BodyEditorNode[]): BodyBlock[] {
  return nodes.map((node): BodyBlock => node.type === 'bulletList'
    ? ['ul', (node.content ?? []).map((item) => compactBlocks(item.content ?? []))]
    : [node.type === 'heading' ? 'h' : 'p', compactInlines(node.content ?? [])]);
}

export function editorDocToWorkBody(doc: BodyEditorNode): string {
  const blocks = compactBlocks(doc.content ?? []);
  if (!blocksText(blocks).trim()) return '';
  const formatted = blocks.some((block) => block[0] !== 'p' || block[1].some((item) => typeof item !== 'string'));
  // Even unstyled new text keeps a hard break explicit; unedited legacy text never reaches here.
  if (!formatted && !blocks.some((block) => block[0] !== 'ul' && inlineText(block[1]).includes('\n'))) return blocksText(blocks);
  return WORK_BODY_PREFIX + JSON.stringify(blocks);
}

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
function inlineHtml(items: BodyInline[]): string {
  return items.map((item) => typeof item === 'string' ? escape(item).replaceAll('\n', '<br/>') : `<strong>${escape(item[1]).replaceAll('\n', '<br/>')}</strong>`).join('');
}
function blocksHtml(blocks: BodyBlock[]): string {
  return blocks.map((block) => block[0] === 'ul'
    ? `<ul>${block[1].map((item) => `<li>${blocksHtml(item)}</li>`).join('')}</ul>`
    : `<${block[0] === 'h' ? 'h3' : 'p'}>${inlineHtml(block[1])}</${block[0] === 'h' ? 'h3' : 'p'}>`).join('');
}
export function renderWorkBodyHtml(value: string): string {
  const blocks = parseWorkBody(value);
  return blocks ? `<div class="work-body-formatted">${blocksHtml(blocks)}</div>` : value.split('\n\n').map((paragraph) => `<p>${escape(paragraph).replaceAll('&#x27;', "'")}</p>`).join('');
}
