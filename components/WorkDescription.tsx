import type { ReactNode } from 'react';

interface WorkDescriptionProps {
  summary: string;
  body: string;
  children?: ReactNode;
}

/** Keep the public description and admin preview's paragraph layout identical. */
export default function WorkDescription({ summary, body, children }: WorkDescriptionProps) {
  return (
    <div className="work-detail-copy">
      <h2 className="work-detail-copy-title">작업 설명</h2>
      <p className="work-detail-summary">{summary}</p>
      {body.split('\n\n').map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {children}
    </div>
  );
}
