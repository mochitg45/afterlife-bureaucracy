import { act, render, screen, fireEvent } from '@testing-library/react';
import { SaveCodeSheet } from './SaveCodeSheet';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

const CODE = 'AB1.ZXhwb3J0ZWQ.0badc0de';

function seed(over: Partial<Parameters<typeof useGame.setState>[0]> = {}) {
  const state = createInitialState({ wall: 0, mono: 0 }, content);
  useGame.setState({
    state,
    rates: computeRates(state, content, 0),
    ready: true,
    exportSaveCode: () => CODE,
    importSaveCode: vi.fn(async () => 'ok' as const),
    ...over,
  });
}

function fakeClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('SaveCodeSheet', () => {
  it('renders nothing when closed', () => {
    seed();
    const { container } = render(<SaveCodeSheet open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the exported code in a read-only field', () => {
    seed();
    render(<SaveCodeSheet open onClose={() => {}} />);
    const field = screen.getByRole('textbox', { name: /your save code/i }) as HTMLTextAreaElement;
    expect(field).toHaveValue(CODE);
    expect(field).toHaveAttribute('readonly');
  });

  it('copies the code to the clipboard', async () => {
    seed();
    const writeText = vi.fn(async () => {});
    fakeClipboard(writeText);
    render(<SaveCodeSheet open onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(screen.getByRole('status')).toHaveTextContent(/copied/i);
  });

  it('says so when the clipboard refuses', async () => {
    seed();
    fakeClipboard(vi.fn(async () => { throw new Error('denied'); }));
    render(<SaveCodeSheet open onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/copy it by hand/i);
  });

  it('imports behind a confirm that warns about the current save', async () => {
    const importSaveCode = vi.fn(async () => 'ok' as const);
    const onClose = vi.fn();
    seed({ importSaveCode });
    render(<SaveCodeSheet open onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox', { name: /paste a save code/i }), { target: { value: CODE } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(importSaveCode).not.toHaveBeenCalled();
    expect(screen.getByText(/replaces your current save/i)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import' })); });
    expect(importSaveCode).toHaveBeenCalledWith(CODE);
    expect(onClose).toHaveBeenCalled();
  });

  it('reports an unreadable code and stays open', async () => {
    const onClose = vi.fn();
    seed({ importSaveCode: vi.fn(async () => 'invalid' as const) });
    render(<SaveCodeSheet open onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox', { name: /paste a save code/i }), { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import' })); });
    expect(screen.getByRole('status')).toHaveTextContent(/could not be read/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('will not import an empty box', () => {
    seed();
    render(<SaveCodeSheet open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    seed();
    render(<SaveCodeSheet open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
