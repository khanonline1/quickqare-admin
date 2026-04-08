import React from "react";
import type { ApiMeta } from "../types/admin";

export default function Pagination({ meta, onPage }: { meta: ApiMeta; onPage: (page: number) => void }) {
  const page = meta.pagination?.page || 1;
  const total = meta.pagination?.total || 0;
  const pageSize = meta.pagination?.pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
      <button className="button secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span className="muted">Page {page} of {totalPages}</span>
      <button className="button secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
