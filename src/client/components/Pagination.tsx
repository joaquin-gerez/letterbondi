interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function visiblePages(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

export function Pagination({ currentPage, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Páginas del catálogo">
      <button type="button" onClick={() => onChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Página anterior">←</button>
      {visiblePages(currentPage, totalPages).map((page, index) => page === 'ellipsis'
        ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
        : <button type="button" key={page} className={page === currentPage ? 'is-current' : ''} aria-current={page === currentPage ? 'page' : undefined} aria-label={`Página ${page}`} onClick={() => onChange(page)}>{page}</button>)}
      <button type="button" onClick={() => onChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Página siguiente">→</button>
    </nav>
  );
}
