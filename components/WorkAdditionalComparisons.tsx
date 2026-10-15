import type { WorkItem, WorkPartMedia } from '@/content/works/types';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import { getWorkComparisonImageAlt, resolveWorkImageSrc } from '@/lib/work-images';

export default function WorkAdditionalComparisons({ work, part }: { work: WorkItem; part: WorkPartMedia }) {
  if (!part.comparisons?.length) return null;
  return <div className="work-additional-comparisons">
    {part.comparisons.map((pair, index) => <figure className="work-additional-comparison" key={`${pair.before}:${pair.after}:${index}`}>
      {pair.caption && <figcaption>{pair.caption}</figcaption>}
      <div className="work-detail-slider">
        <BeforeAfterSlider
          beforeSrc={resolveWorkImageSrc(pair.before)} afterSrc={resolveWorkImageSrc(pair.after)}
          beforeAlt={getWorkComparisonImageAlt(work, part, pair, '전')}
          afterAlt={getWorkComparisonImageAlt(work, part, pair, '후')}
          mode="drag" showHint enableZoom
        />
      </div>
    </figure>)}
  </div>;
}
