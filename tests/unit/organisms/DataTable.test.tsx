import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable, DataTableColumn } from '../../../src/components/organisms/DataTable';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

interface Row {
  id: number;
  name: string;
  size: number;
}

const columns: DataTableColumn<Row>[] = [
  {
    key: 'name',
    header: 'Nome',
    className: 'font-mono text-textMain',
    sortValue: (row) => row.name,
    render: (row) => row.name,
  },
  {
    key: 'size',
    header: 'Tamanho',
    sortValue: (row) => row.size,
    render: (row) => `${row.size} KB`,
  },
  {
    key: 'actions',
    header: 'Ações',
    align: 'right',
    render: () => <button type="button">Remover</button>,
  },
];

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `item-${String(i + 1).padStart(2, '0')}`,
    size: count - i,
  }));

const renderTable = (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) => {
  const merged = {
    columns,
    rows: makeRows(3),
    rowKey: (row: Row) => row.id,
    emptyMessage: 'Nada por aqui.',
    ...props,
  };
  const result = render(
    <LanguageProvider>
      <DataTable<Row> {...merged} />
    </LanguageProvider>
  );
  return { ...result, props: merged };
};

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('DataTable', () => {
  it('renders the empty message and no table when there are no rows', () => {
    renderTable({ rows: [] });
    expect(screen.getByText('Nada por aqui.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('applies the initial sort', () => {
    renderTable({ rows: makeRows(3), initialSort: { key: 'name', dir: 'desc' } });
    expect(bodyNames()).toEqual(['item-03', 'item-02', 'item-01']);
  });

  it('sorts ascending on first header click and toggles to descending on the second', () => {
    const { container } = renderTable({ rows: makeRows(3) });
    const nameHeader = container.querySelector('[data-cy="table-sort-name"]')!;

    fireEvent.click(nameHeader);
    expect(bodyNames()).toEqual(['item-01', 'item-02', 'item-03']);

    fireEvent.click(nameHeader);
    expect(bodyNames()).toEqual(['item-03', 'item-02', 'item-01']);
  });

  it('sorts numeric columns numerically, not lexicographically', () => {
    const rows = [
      { id: 1, name: 'a', size: 9 },
      { id: 2, name: 'b', size: 100 },
      { id: 3, name: 'c', size: 20 },
    ];
    renderTable({ rows, initialSort: { key: 'size', dir: 'asc' } });
    expect(bodyNames()).toEqual(['a', 'c', 'b']);
  });

  it('exposes aria-sort on the active column only', () => {
    renderTable({ rows: makeRows(3), initialSort: { key: 'name', dir: 'asc' } });
    const headers = screen.getAllByRole('columnheader');

    expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');
    expect(headers[1]).toHaveAttribute('aria-sort', 'none');
    expect(headers[2]).toHaveAttribute('aria-sort', 'none');
  });

  it('does not render a sort button for columns without a sortValue', () => {
    renderTable({ rows: makeRows(3) });
    const actionsHeader = screen.getAllByRole('columnheader')[2];

    expect(actionsHeader).toHaveTextContent('Ações');
    expect(within(actionsHeader).queryByRole('button')).not.toBeInTheDocument();
  });

  it('paginates rows and reports the visible range', () => {
    renderTable({ rows: makeRows(25), initialSort: { key: 'name', dir: 'asc' } });

    expect(bodyNames()).toHaveLength(10);
    expect(screen.getByText('Mostrando 1–10 de 25')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('navigates between pages', () => {
    renderTable({ rows: makeRows(25), initialSort: { key: 'name', dir: 'asc' } });

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(bodyNames()[0]).toBe('item-11');
    expect(screen.getByText('Mostrando 11–20 de 25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Anterior/i }));
    expect(bodyNames()[0]).toBe('item-01');
  });

  it('disables the pagination edges on the first and last page', () => {
    renderTable({ rows: makeRows(25), initialSort: { key: 'name', dir: 'asc' } });

    expect(screen.getByRole('button', { name: /Anterior/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(screen.getByRole('button', { name: /Próxima/i })).toBeDisabled();
    expect(screen.getByText('Mostrando 21–25 de 25')).toBeInTheDocument();
  });

  it('hides the pagination footer when every row fits on one page', () => {
    renderTable({ rows: makeRows(10) });
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('returns to the first page when the sort changes', () => {
    const { container } = renderTable({
      rows: makeRows(25),
      initialSort: { key: 'name', dir: 'asc' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(container.querySelector('[data-cy="table-sort-size"]')!);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–10 de 25')).toBeInTheDocument();
  });

  it('clamps to the last existing page when rows are removed', () => {
    const { rerender } = renderTable({
      rows: makeRows(25),
      initialSort: { key: 'name', dir: 'asc' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    fireEvent.click(screen.getByRole('button', { name: /Próxima/i }));
    expect(screen.getByText('3/3')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <DataTable<Row>
          columns={columns}
          rows={makeRows(12)}
          rowKey={(row) => row.id}
          emptyMessage="Nada por aqui."
          initialSort={{ key: 'name', dir: 'asc' }}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(bodyNames()).toHaveLength(2);
  });

  it('renders every row when pagination is disabled', () => {
    renderTable({ rows: makeRows(25), pageSize: 0 });
    expect(bodyNames()).toHaveLength(25);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  // Guardrail from .agents/rules/responsive-management-layouts.md: narrow windows must
  // scroll the table instead of overflowing the page.
  it('keeps the horizontal scroll wrapper and a stable minimum table width', () => {
    const { container } = renderTable({ testId: 'sample-table' });

    expect(container.querySelector('[data-cy="sample-table"]')).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('table')).toHaveClass('min-w-[640px]');
  });

  it('honours a custom minimum width for wider column sets', () => {
    renderTable({ minWidthClass: 'min-w-[900px]' });
    expect(screen.getByRole('table')).toHaveClass('min-w-[900px]');
  });

  it('leaves rows in their original order when initialSort names an unknown column', () => {
    renderTable({ rows: makeRows(3), initialSort: { key: 'nope', dir: 'desc' } });

    expect(bodyNames()).toEqual(['item-01', 'item-02', 'item-03']);
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('aria-sort', 'none');
    }
  });

  it('ignores initialSort pointing at a column that has no sortValue', () => {
    renderTable({ rows: makeRows(3), initialSort: { key: 'actions', dir: 'desc' } });

    expect(bodyNames()).toEqual(['item-01', 'item-02', 'item-03']);
    expect(screen.getAllByRole('columnheader')[2]).toHaveAttribute('aria-sort', 'none');
  });

  it('does not mutate the rows array it was given', () => {
    const rows = makeRows(3);
    const original = [...rows];
    renderTable({ rows, initialSort: { key: 'name', dir: 'desc' } });

    expect(rows).toEqual(original);
  });
});
