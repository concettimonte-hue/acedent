import type { WorkItem, WorkPartValue } from '../content/works/types';

export function getWorkFilterParts(work: WorkItem): WorkPartValue[] {
  const actualParts = work.parts.flatMap((part) => part.part ?? []);
  const fallbackParts = actualParts.length > 0 ? actualParts : work.part;
  return [...new Set(fallbackParts.filter(Boolean))];
}

export function formatWorkCardParts(work: WorkItem) {
  const filterParts = getWorkFilterParts(work);
  const primaryPart = work.part[0] ?? filterParts[0];
  const cardParts = [primaryPart, ...filterParts.filter((part) => part !== primaryPart)]
    .filter((part): part is WorkPartValue => Boolean(part));

  if (cardParts.length <= 1) return cardParts[0] ?? '';
  if (cardParts.length === 2) return `${cardParts[0]} · ${cardParts[1]}`;
  return `${cardParts[0]} 외 ${cardParts.length - 1}`;
}
