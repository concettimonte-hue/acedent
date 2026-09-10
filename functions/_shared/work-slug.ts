interface WorkSlugPartInput {
  part: unknown;
  detail?: string;
}

interface WorkSlugInput {
  carMaker: string;
  carModel?: string;
  category: string;
  parts: WorkSlugPartInput[];
}

const makerTerms: Record<string, string> = {
  벤츠: 'mercedes',
  메르세데스벤츠: 'mercedes',
  포르쉐: 'porsche',
  테슬라: 'tesla',
  지프: 'jeep',
  랜드로버: 'land-rover',
  제네시스: 'genesis',
  현대: 'hyundai',
  기아: 'kia',
  아우디: 'audi',
  폭스바겐: 'volkswagen',
  볼보: 'volvo',
  렉서스: 'lexus',
};

const detailTerms: Record<string, string> = {
  전면: 'front',
  후면: 'rear',
  측면: 'side',
  옆면: 'side',
  앞: 'front',
  뒤: 'rear',
  좌측: 'left',
  우측: 'right',
  가니쉬: 'garnish',
};

const partTerms: Record<string, string> = {
  범퍼: 'bumper',
  도어: 'door',
  휀더: 'fender',
  후드: 'hood',
  트렁크: 'trunk',
  사이드미러: 'side-mirror',
  필러: 'pillar',
  루프: 'roof',
  휠: 'wheel',
  사이드스텝: 'side-step',
};

const modelTerms: Record<string, string> = {
  파나메라: 'panamera',
  레니게이드: 'renegade',
  모델3: 'model3',
  디펜더: 'defender',
  디스커버리: 'discovery',
};

const initialSounds = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];
const medialSounds = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];
const finalSounds = [
  '', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h',
];

function compactKorean(value: string) {
  return value.normalize('NFKC').replace(/[\s·.()_-]/g, '').toLowerCase();
}

function romanizeHangul(value: string) {
  return [...value.normalize('NFKC')].map((character) => {
    const code = character.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return character;
    const syllable = code - 0xac00;
    const initial = Math.floor(syllable / 588);
    const medial = Math.floor((syllable % 588) / 28);
    const final = syllable % 28;
    return `${initialSounds[initial]}${medialSounds[medial]}${finalSounds[final]}`;
  }).join('');
}

function safeSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function workSlugTerm(value: string | undefined, terms: Record<string, string> = {}) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  const compact = compactKorean(trimmed);
  if (terms[compact]) return terms[compact];
  return safeSegment(romanizeHangul(trimmed));
}

export function createBaseWorkSlug(input: WorkSlugInput) {
  const first = input.parts[0];
  const firstPart = Array.isArray(first?.part) ? first.part[0] : first?.part;
  const part = workSlugTerm(typeof firstPart === 'string' ? firstPart : '', partTerms);
  const detail = workSlugTerm(first?.detail, detailTerms);

  return [
    workSlugTerm(input.carMaker, makerTerms),
    workSlugTerm(input.carModel, modelTerms),
    detail,
    part,
    workSlugTerm(input.category),
  ].filter(Boolean).join('-');
}

export function nextNumericWorkSlug(base: string, existing: Iterable<string>) {
  const used = new Set(existing);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
