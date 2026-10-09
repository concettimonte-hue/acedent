import type { CSSProperties } from 'react';
import type { WorkImageAnnotation } from '@/content/works/types';
import { annotationArrowGeometry } from '@/lib/work-annotations';

interface ImageAnnotationsProps {
  annotations?: readonly WorkImageAnnotation[];
  className?: string;
  fit?: 'cover' | 'contain';
  style?: CSSProperties;
}

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 1200;

export default function ImageAnnotations({
  annotations = [],
  className = '',
  fit = 'cover',
  style,
}: ImageAnnotationsProps) {
  if (annotations.length === 0) return null;

  return (
    <svg
      className={`work-image-annotations${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio={`xMidYMid ${fit === 'contain' ? 'meet' : 'slice'}`}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {annotations.map((annotation, index) => {
        if (annotation.type === 'circle') {
          const centerX = (annotation.x + annotation.width / 2) * VIEWBOX_WIDTH;
          const centerY = (annotation.y + annotation.height / 2) * VIEWBOX_HEIGHT;
          const radiusX = annotation.width * VIEWBOX_WIDTH / 2;
          const radiusY = annotation.height * VIEWBOX_HEIGHT / 2;
          return (
            <g key={`circle-${index}`}>
              <ellipse cx={centerX} cy={centerY} rx={radiusX} ry={radiusY} className="work-image-annotation-outline" />
              <ellipse cx={centerX} cy={centerY} rx={radiusX} ry={radiusY} className="work-image-annotation-mark" />
            </g>
          );
        }
        const startX = annotation.startX * VIEWBOX_WIDTH;
        const startY = annotation.startY * VIEWBOX_HEIGHT;
        const endX = annotation.endX * VIEWBOX_WIDTH;
        const endY = annotation.endY * VIEWBOX_HEIGHT;
        const arrow = annotationArrowGeometry(startX, startY, endX, endY);
        return (
          <g key={`arrow-${index}`}>
            <path d={arrow.path} className="work-image-annotation-outline" style={{ strokeWidth: arrow.outlineWidth }} />
            <path d={arrow.path} className="work-image-annotation-mark" style={{ strokeWidth: arrow.markWidth }} />
          </g>
        );
      })}
    </svg>
  );
}
