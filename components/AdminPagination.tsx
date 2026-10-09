import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminPagination({ page, pages, total, onChange }: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="admin-pagination" aria-label="목록 페이지">
      <output>{total.toLocaleString()}건 · {page} / {pages}페이지</output>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지"><ChevronLeft aria-hidden="true" /> 이전</button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="다음 페이지">다음 <ChevronRight aria-hidden="true" /></button>
      </div>
    </nav>
  );
}
