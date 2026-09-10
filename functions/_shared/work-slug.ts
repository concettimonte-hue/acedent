import {
  SLUG_CAR_MAKER_TERMS,
  SLUG_CAR_MODEL_TERMS,
  SLUG_LOCATION_TERMS,
  SLUG_PART_TERMS,
  SLUG_WORK_TERMS,
} from '../../lib/slug-dictionary';

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

function compactKorean(value: string) {
  return value.normalize('NFKC').replace(/[\s·.,/\\+()_-]/g, '').toLowerCase();
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

interface FieldAnalysis {
  tokens: string[];
  excludedTerms: string[];
}

export interface WorkSlugAnalysis {
  slug: string;
  excludedTerms: string[];
}

const tokenSeparators = /[\s·.,/\\+()_-]+/u;
const hangulPattern = /[가-힣]+/gu;

function normalizedDictionary(terms: Record<string, string>) {
  return new Map(Object.entries(terms).map(([term, value]) => [compactKorean(term), value]));
}

function segmentKnownTerm(value: string, terms: Map<string, string>) {
  const aliases = [...terms.keys()].sort((left, right) => right.length - left.length);
  const memo = new Map<number, string[] | null>();
  const visit = (index: number): string[] | null => {
    if (index === value.length) return [];
    if (memo.has(index)) return memo.get(index) ?? null;
    for (const alias of aliases) {
      if (!value.startsWith(alias, index)) continue;
      const rest = visit(index + alias.length);
      if (rest) {
        const result = [terms.get(alias)!, ...rest];
        memo.set(index, result);
        return result;
      }
    }
    memo.set(index, null);
    return null;
  };
  return visit(0);
}

function analyzeField(value: string | undefined, terms: Record<string, string>, allowAscii: boolean): FieldAnalysis {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return { tokens: [], excludedTerms: [] };
  const dictionary = normalizedDictionary(terms);
  const compact = compactKorean(trimmed);
  const exact = dictionary.get(compact);
  if (exact) return { tokens: [exact], excludedTerms: [] };

  const tokens: string[] = [];
  const excludedTerms: string[] = [];
  for (const rawTerm of trimmed.normalize('NFKC').split(tokenSeparators).filter(Boolean)) {
    const normalized = compactKorean(rawTerm);
    const mapped = dictionary.get(normalized);
    if (mapped) {
      tokens.push(mapped);
      continue;
    }
    const segmented = segmentKnownTerm(normalized, dictionary);
    if (segmented) {
      tokens.push(...segmented);
      continue;
    }
    const unknownKorean = rawTerm.match(hangulPattern) ?? [];
    excludedTerms.push(...unknownKorean);
    if (allowAscii) {
      const ascii = safeSegment(rawTerm.replace(hangulPattern, ''));
      if (ascii) tokens.push(ascii);
    }
  }
  return { tokens, excludedTerms };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function removeGenericParts(values: string[]) {
  const parts = unique(values);
  const specificGroups: Record<string, string[]> = {
    door: ['front-door', 'rear-door'],
    bumper: ['front-bumper', 'rear-bumper'],
    fender: ['front-fender', 'rear-fender'],
  };
  return parts.filter((part) => {
    const specifics = specificGroups[part];
    return !specifics?.some((specific) => parts.includes(specific));
  });
}

export function createWorkSlugAnalysis(input: WorkSlugInput): WorkSlugAnalysis {
  const first = input.parts[0];
  const firstParts = Array.isArray(first?.part) ? first.part : [first?.part];
  const partSources = [
    first?.detail,
    ...firstParts.filter((part): part is string => typeof part === 'string'),
  ];
  const maker = analyzeField(input.carMaker, SLUG_CAR_MAKER_TERMS, true);
  const model = analyzeField(input.carModel, SLUG_CAR_MODEL_TERMS, true);
  const locationsFromParts = partSources.map((part) => analyzeField(part, SLUG_LOCATION_TERMS, false));
  const normalizedParts = partSources.map((part) => analyzeField(part, SLUG_PART_TERMS, false));
  const combinedPartTerms = { ...SLUG_LOCATION_TERMS, ...SLUG_PART_TERMS };
  const analyzedPartSources = partSources.map((part) => analyzeField(part, combinedPartTerms, false));
  const work = analyzeField(input.category, SLUG_WORK_TERMS, true);

  const parts = removeGenericParts(normalizedParts.flatMap((part) => part.tokens));
  const specificDirections = new Set(parts.flatMap((part) => {
    if (part.startsWith('front-')) return ['front'];
    if (part.startsWith('rear-')) return ['rear'];
    if (part.startsWith('side-')) return ['side'];
    return [];
  }));
  const locations = unique(locationsFromParts.flatMap((part) => part.tokens))
    .filter((location) => !specificDirections.has(location));
  const slug = unique([
    ...maker.tokens,
    ...model.tokens,
    ...locations,
    ...parts,
    ...work.tokens,
  ]).join('-');

  return {
    slug,
    excludedTerms: unique([
      ...maker.excludedTerms,
      ...model.excludedTerms,
      ...analyzedPartSources.flatMap((part) => part.excludedTerms),
      ...work.excludedTerms,
    ]),
  };
}

export function createBaseWorkSlug(input: WorkSlugInput) {
  return createWorkSlugAnalysis(input).slug;
}

export function nextNumericWorkSlug(base: string, existing: Iterable<string>) {
  const used = new Set(existing);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
