'use client';

import { ArrowUpRight } from 'lucide-react';
import SectionNumber from '@/components/SectionNumber';
import naverData from '@/content/naver.json';
import reviewsData from '@/content/reviews.json';
import type { NaverContent, ReviewsContent } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const content = reviewsData as ReviewsContent;
const naver = naverData as NaverContent;
const reviews = content.reviews.filter((review) => review.highlight);

function ReviewCard({
  review,
  featured = false,
}: {
  review: (typeof reviews)[number];
  featured?: boolean;
}) {
  return (
    <article
      className={`review-card${featured ? ' review-card-featured' : ''}`}
    >
      <h3>{review.headline}</h3>
      <p>{review.text}</p>
      <div className="review-meta">
        {review.initial} · {review.car} · {review.area} · {review.part}
      </div>
    </article>
  );
}

export default function ReviewsSection() {
  return (
    <section
      id="reviews"
      className="section content-section reviews-section numbered-section"
    >
      <header className="content-section-header dark-header">
        <div>
          <p className="section-kicker light">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
          <p className="content-section-subcopy">{content.subCopy}</p>
        </div>
        <SectionNumber sectionId="reviews" />
      </header>

      <div className="reviews-grid">
        {reviews[0] && <ReviewCard review={reviews[0]} featured />}
        <div className="reviews-row">
          {reviews.slice(1).map((review) => (
            <ReviewCard review={review} key={review.id} />
          ))}
        </div>
      </div>

      <div className="section-text-link-wrap">
        <a
          href={withLandingUtm(naver.review, 'review')}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content.moreLinkLabel} <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
