import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SchedulingPage } from '../../../src/components/pages/SchedulingPage';
import { ScheduledTaskItem } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const tasks: ScheduledTaskItem[] = [
  { Name: 'VeloSysPro_Quick', State: 'Ready', Path: '\\VeloSysPro_Quick' },
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

describe('SchedulingPage (functional scheduler)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists existing scheduled tasks', () => {
    renderPage();
    expect(screen.getByText('VeloSysPro_Quick')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows an empty state when there are no tasks', () => {
    renderPage({ tasks: [] });
    expect(screen.getByText(/Nenhuma tarefa agendada/i)).toBeInTheDocument();
  });

  it('creates a task with a JSON payload of type/frequency/time', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Agendar/i }));
    expect(props.onCreateTask).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((props.onCreateTask as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(payload).toMatchObject({ type: 'quick', frequency: 'DAILY', time: '03:00' });
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

  it('deletes a task only after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderPage();
    fireEvent.click(screen.getByText(/Remover/i));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onDeleteTask).toHaveBeenCalledWith('VeloSysPro_Quick');
  });
});
