import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SchedulingPage } from '../../../src/components/pages/SchedulingPage';
import { ScheduledTaskItem } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const tasks: ScheduledTaskItem[] = [
  {
    Name: 'VeloSysPro_Quick_Daily_0300',
    State: 'Ready',
    Path: '\\VeloSysPro_Quick_Daily_0300',
  },
];

const renderPage = (props: Partial<React.ComponentProps<typeof SchedulingPage>> = {}) => {
  const merged = {
    tasks,
    onCreateTask: vi.fn(),
    onDeleteTask: vi.fn(),
    ...props,
  };
  render(
    <LanguageProvider>
      <SchedulingPage {...merged} />
    </LanguageProvider>
  );
  return merged;
};

const lastPayload = (fn: unknown) =>
  JSON.parse((fn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);

describe('SchedulingPage (functional scheduler)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('describes a task by frequency and optimization instead of its technical name', () => {
    renderPage();
    expect(screen.getByText('Diária - Otimização Rápida')).toBeInTheDocument();
    expect(screen.getByText('Todos os dias às 03:00')).toBeInTheDocument();
    expect(screen.queryByText('VeloSysPro_Quick_Daily_0300')).not.toBeInTheDocument();
  });

  it('translates the Windows task state into a badge', () => {
    renderPage();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('describes weekly and monthly cadences with their day', () => {
    renderPage({
      tasks: [
        {
          Name: 'VeloSysPro_Gaming_Weekly_MON_0430',
          State: 'Running',
          Path: '\\VeloSysPro_Gaming_Weekly_MON_0430',
        },
        {
          Name: 'VeloSysPro_Full_Monthly_15_0200',
          State: 'Ready',
          Path: '\\VeloSysPro_Full_Monthly_15_0200',
        },
      ],
    });

    expect(screen.getByText('Semanal - Modo Gaming')).toBeInTheDocument();
    expect(screen.getByText('Toda segunda-feira às 04:30')).toBeInTheDocument();
    expect(screen.getByText('Todo dia 15 às 02:00')).toBeInTheDocument();
  });

  it('keeps legacy tasks listed and removable', () => {
    const props = renderPage({
      tasks: [{ Name: 'VeloSysPro_Quick', State: 'Ready', Path: '\\VeloSysPro_Quick' }],
    });

    // Scoped to the table: "Otimização Rápida" is also a <option> in the type dropdown.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Otimização Rápida')).toBeInTheDocument();
    expect(table.getByText('—')).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText(/Remover/i));
    expect(props.onDeleteTask).toHaveBeenCalledWith('VeloSysPro_Quick');
  });

  it('lets several schedules of the same optimization coexist', () => {
    renderPage({
      tasks: [
        {
          Name: 'VeloSysPro_Quick_Daily_0300',
          State: 'Ready',
          Path: '\\VeloSysPro_Quick_Daily_0300',
        },
        {
          Name: 'VeloSysPro_Quick_Daily_0500',
          State: 'Ready',
          Path: '\\VeloSysPro_Quick_Daily_0500',
        },
      ],
    });

    expect(screen.getAllByText('Diária - Otimização Rápida')).toHaveLength(2);
    expect(screen.getByText('Todos os dias às 03:00')).toBeInTheDocument();
    expect(screen.getByText('Todos os dias às 05:00')).toBeInTheDocument();
  });

  it('shows an empty state when there are no tasks', () => {
    renderPage({ tasks: [] });
    expect(screen.getByText(/Nenhuma tarefa agendada/i)).toBeInTheDocument();
  });

  it('creates a daily task without a day component', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Agendar/i }));

    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    expect(lastPayload(props.onCreateTask)).toEqual({
      type: 'quick',
      frequency: 'DAILY',
      time: '03:00',
      day: '',
    });
  });

  it('offers a weekday picker only for weekly schedules', () => {
    const props = renderPage();
    expect(screen.queryByLabelText(/Dia da semana/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'WEEKLY' } });
    const weekday = screen.getByLabelText(/Dia da semana/i);
    expect(weekday).toBeInTheDocument();
    expect(screen.queryByLabelText(/Dia do mês/i)).not.toBeInTheDocument();

    fireEvent.change(weekday, { target: { value: 'FRI' } });
    fireEvent.click(screen.getByRole('button', { name: /Agendar/i }));
    expect(lastPayload(props.onCreateTask)).toMatchObject({ frequency: 'WEEKLY', day: 'FRI' });
  });

  it('offers a day-of-month grid only for monthly schedules', () => {
    const props = renderPage();
    expect(screen.queryByRole('radiogroup', { name: /Dia do mês/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Frequência/i), { target: { value: 'MONTHLY' } });
    const grid = screen.getByRole('radiogroup', { name: /Dia do mês/i });
    expect(screen.queryByLabelText(/Dia da semana/i)).not.toBeInTheDocument();
    expect(within(grid).getAllByRole('radio')).toHaveLength(31);

    fireEvent.click(within(grid).getByRole('radio', { name: '15' }));
    expect(within(grid).getByRole('radio', { name: '15' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /Agendar/i }));
    expect(lastPayload(props.onCreateTask)).toMatchObject({ frequency: 'MONTHLY', day: '15' });
  });

  it('renders controls before the full-width scheduling action', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Agendar/i });
    const typeSelect = screen.getByLabelText(/Otimização/i);

    expect(
      typeSelect.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(button.parentElement).toHaveClass('flex-col', 'gap-5');
  });

  it('keeps the task table horizontally scrollable on narrow windows', () => {
    const { container } = render(
      <LanguageProvider>
        <SchedulingPage tasks={tasks} onCreateTask={vi.fn()} onDeleteTask={vi.fn()} />
      </LanguageProvider>
    );

    expect(container.querySelector('[data-cy="tasks-table"]')).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('table')).toHaveClass('min-w-[640px]');
  });

  it('deletes a task only after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderPage();
    fireEvent.click(screen.getByText(/Remover/i));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onDeleteTask).toHaveBeenCalledWith('VeloSysPro_Quick_Daily_0300');
  });
});
