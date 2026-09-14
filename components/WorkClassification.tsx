'use client';

import { getWorkCategoryLabel, type WorkItem } from '@/content/works/types';
import { getWorkDisplayCategories } from '@/lib/work-categories';

interface WorkClassificationProps {
  work: WorkItem;
}

export default function WorkClassification({ work }: WorkClassificationProps) {
  const categories = getWorkDisplayCategories(work);
  const primaryCategory = categories[0] ?? work.category;
  const secondaryCategories = categories.slice(1);

  return (
    <div className="work-detail-classification">
      <span className="work-detail-classification-primary">
        {getWorkCategoryLabel(primaryCategory)}
      </span>
      {secondaryCategories.map((category) => (
        <span className="work-detail-classification-secondary-group" key={category}>
          <span className="work-detail-classification-separator" aria-hidden="true">·</span>
          <span className="work-detail-classification-secondary">
            {getWorkCategoryLabel(category)}
          </span>
        </span>
      ))}
    </div>
  );
}
