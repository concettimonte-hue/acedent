'use client';

import {
  getSectionNumber,
  type NumberedSectionId,
} from '@/content/section-order';

export default function SectionNumber({
  sectionId,
  corner = false,
}: {
  sectionId: NumberedSectionId;
  corner?: boolean;
}) {
  return (
    <span
      className={`content-section-number${corner ? ' section-corner-number' : ''}`}
      aria-hidden="true"
    >
      {getSectionNumber(sectionId)}
    </span>
  );
}
