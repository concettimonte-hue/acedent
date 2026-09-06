export const NUMBERED_SECTION_ORDER = [
  { id: 'services', label: 'WHAT WE DO' },
  { id: 'cases', label: 'ACTUAL RESULTS' },
  { id: 'paint-care', label: 'PAINT CARE' },
  { id: 'reasons', label: 'WHY ACE DENT' },
  { id: 'principle', label: 'OUR PRINCIPLE' },
  { id: 'reviews', label: 'CUSTOMER VOICE' },
  { id: 'insurance', label: 'INSURANCE GUIDE' },
  { id: 'process', label: 'HOW IT WORKS' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'CONTACT' },
  { id: 'location', label: 'VISIT US' },
] as const;

export type NumberedSectionId = (typeof NUMBERED_SECTION_ORDER)[number]['id'];

export function getSectionNumber(sectionId: NumberedSectionId) {
  const index = NUMBERED_SECTION_ORDER.findIndex(
    (section) => section.id === sectionId,
  );

  if (index < 0) return '';
  return String(index + 1).padStart(2, '0');
}
