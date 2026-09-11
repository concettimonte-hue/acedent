'use client';

import {
  getWorkCategoryLabel,
  type WorkCategory,
} from '@/content/works/types';

interface WorkClassificationProps {
  category: WorkCategory;
  subCategories?: readonly WorkCategory[];
}

export default function WorkClassification({
  category,
  subCategories = [],
}: WorkClassificationProps) {
  return (
    <div className="work-detail-classification">
      <span className="work-detail-classification-primary">
        {getWorkCategoryLabel(category)}
      </span>
      {subCategories.map((subCategory) => (
        <span className="work-detail-classification-secondary-group" key={subCategory}>
          <span className="work-detail-classification-separator" aria-hidden="true">·</span>
          <span className="work-detail-classification-secondary">
            {getWorkCategoryLabel(subCategory)}
          </span>
        </span>
      ))}
    </div>
  );
}
