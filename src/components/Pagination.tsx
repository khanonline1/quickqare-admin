import React from "react";
import type { ApiMeta } from "../types/admin";

export default function Pagination({ meta, onPage }: { meta: ApiMeta; onPage: (page: number) => void }) {
  const page = meta.pagination?.page || 1;
  const total = meta.pagination?.total || 0;
  const pageSize = meta.pagination?.pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="pagination-controls">
        <button
          className="button secondary sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 13, color: "var(--muted)", padding: "0 4px" }}>
          {page} / {totalPages}
        </span>
        <button
          className="button secondary sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
