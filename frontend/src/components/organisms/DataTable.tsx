import React, { useMemo, useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Stable identifier used for sort state and test hooks. */
  key: string;
  /** Already-translated column label. */
  header: string;
  align?: 'left' | 'right';
  /** Extra cell classes, e.g. 'font-mono text-textMain' for identifier columns. */
  className?: string;
  /** Comparable value for this column. Omit to make the column non-sortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Already-translated message rendered when there are no rows. */
  emptyMessage: string;
  initialSort?: { key: string; dir: SortDirection };
  /** Rows per page. Pass 0 to render every row without a pagination footer. */
  pageSize?: number;
  minWidthClass?: string;
  /** Re-request the rows from the host. Omit to hide the refresh control entirely. */
  onRefresh?: () => void;
  /** Mirrors the app's in-flight action lock. */
  disabled?: boolean;
  testId?: string;
}

function compare<T>(column: DataTableColumn<T>, a: T, b: T): number {
  const av = column.sortValue!(a);
  const bv = column.sortValue!(b);

  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv), undefined, { numeric: true });
}

/**
 * Sortable, paginated table shared by every management screen.
 *
 * Keeps the horizontal-scroll wrapper and a stable minimum width so narrow windows scroll
 * the table instead of overflowing the page (see .agents/rules/responsive-management-layouts.md).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  initialSort,
  pageSize = 10,
  minWidthClass = 'min-w-[640px]',
  onRefresh,
  disabled = false,
  testId,
}: DataTableProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort?.key);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSort?.dir ?? 'asc');
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey && c.sortValue);
    if (!column) return rows;

    const factor = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compare(column, a, b) * factor);
  }, [columns, rows, sortKey, sortDir]);

  const paginated = pageSize > 0 && sortedRows.length > pageSize;
  const totalPages = paginated ? Math.ceil(sortedRows.length / pageSize) : 1;

  // Never strand the user on a page that no longer exists after rows are removed.
  if (page >= totalPages) {
    setPage(totalPages - 1);
  }

  const currentPage = Math.min(page, totalPages - 1);
  const start = paginated ? currentPage * pageSize : 0;
  const visibleRows = paginated ? sortedRows.slice(start, start + pageSize) : sortedRows;

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return;
    if (column.key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Sits above the scroll wrapper so it stays put when a narrow window scrolls the
          table, and outside the empty-state branch because an empty list is exactly when
          the user wants to re-query the host. */}
      {onRefresh && (
        <div className="flex justify-end">
          <Button
            testId="table-refresh"
            variant="primary"
            className="w-auto gap-1.5 px-4 py-2"
            disabled={disabled}
            onClick={onRefresh}
          >
            <Icon name="refresh-cw" /> {t('table.refresh')}
          </Button>
        </div>
      )}

      <div
        data-cy={testId}
        className="overflow-x-auto rounded-xl border border-borderColor bg-bgCard"
      >
        {rows.length === 0 ? (
          <p className="p-8 text-center text-xs text-textMuted">{emptyMessage}</p>
        ) : (
          <>
            <table className={`w-full ${minWidthClass} text-left text-xs`}>
              <thead>
                <tr className="border-b border-borderColor text-textMuted">
                  {columns.map((column) => {
                    const active = column.key === sortKey && !!column.sortValue;
                    const alignClass = column.align === 'right' ? 'text-right' : '';

                    return (
                      <th
                        key={column.key}
                        aria-sort={
                          active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                        className={`px-5 py-3 font-semibold ${alignClass}`}
                      >
                        {column.sortValue ? (
                          <button
                            type="button"
                            data-cy={`table-sort-${column.key}`}
                            aria-label={t(
                              active && sortDir === 'asc' ? 'table.sortDesc' : 'table.sortAsc'
                            )}
                            onClick={() => handleSort(column)}
                            className={`flex items-center gap-1.5 font-semibold transition-colors hover:text-textMain ${
                              active ? 'text-textMain' : ''
                            } ${column.align === 'right' ? 'ml-auto' : ''}`}
                          >
                            {column.header}
                            <Icon
                              name={active && sortDir === 'desc' ? 'chevron-down' : 'chevron-up'}
                              className={`h-3 w-3 ${active ? '' : 'opacity-30'}`}
                            />
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-borderColor/50 last:border-none hover:bg-white/5"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-5 py-3 ${column.align === 'right' ? 'text-right' : ''} ${
                          column.className ?? 'text-textMuted'
                        }`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {paginated && (
              <div className="flex flex-col gap-3 border-t border-borderColor px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span data-cy="table-range" className="text-xs text-textMuted">
                  {t('table.range', {
                    from: start + 1,
                    to: start + visibleRows.length,
                    total: sortedRows.length,
                  })}
                </span>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Button
                    testId="table-prev"
                    variant="primary"
                    className="w-auto gap-1.5 px-4 py-2"
                    disabled={currentPage === 0}
                    onClick={() => setPage(Math.max(0, currentPage - 1))}
                  >
                    <Icon name="chevron-left" /> {t('table.prev')}
                  </Button>
                  <span data-cy="table-page" className="text-xs font-semibold text-textMuted">
                    {currentPage + 1}/{totalPages}
                  </span>
                  <Button
                    testId="table-next"
                    variant="primary"
                    className="w-auto gap-1.5 px-4 py-2"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                  >
                    {t('table.next')} <Icon name="chevron-right" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
