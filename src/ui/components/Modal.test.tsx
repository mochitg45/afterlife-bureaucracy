import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} title="Settings"><button>One</button></Modal>);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the dialog from its visible title', () => {
    render(<Modal open title="Overnight Backlog Report"><button>One</button></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Overnight Backlog Report' });
    expect(dialog).toHaveAttribute('aria-labelledby', screen.getByRole('heading').id);
  });

  it('prefers an explicit label over the visible title', () => {
    render(<Modal open title="Books closed." label="Fiscal Year Audit"><button>One</button></Modal>);
    expect(screen.getByRole('dialog', { name: 'Fiscal Year Audit' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
  });

  it('puts initial focus on the first button', () => {
    render(<Modal open title="Settings"><input aria-label="Toggle" type="checkbox" /><button>First</button><button>Second</button></Modal>);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('traps Tab at both ends', () => {
    render(<Modal open title="Settings"><button>First</button><button>Second</button></Modal>);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(second).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('skips disabled controls in the trap', () => {
    render(<Modal open title="Settings"><button>First</button><button disabled>Middle</button><button>Last</button></Modal>);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('closes on Escape when onClose is given', () => {
    const onClose = vi.fn();
    render(<Modal open title="Settings" onClose={onClose}><button>One</button></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores Escape for a ceremony with no onClose', () => {
    render(<Modal open title="Cosmic Restructuring"><button>One</button></Modal>);
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('puts the header above the title and applies both class names', () => {
    render(
      <Modal open title="Books closed." backdropClassName="ceremony" className="stamped" header={<svg data-testid="stamp" />}>
        <button>One</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('stamped');
    expect(dialog.parentElement).toHaveClass('ceremony');
    expect(dialog.firstElementChild).toBe(screen.getByTestId('stamp'));
  });
});
