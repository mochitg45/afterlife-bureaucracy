import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { CloudNotice } from './CloudNotice';
import { useGame, type CloudNotice as Notice } from '../../store/game';

function seed(cloudNotice: Notice | null) {
  useGame.setState({ cloudNotice, ready: true });
}

describe('CloudNotice', () => {
  it('renders nothing when there is no notice', () => {
    seed(null);
    const { container } = render(<CloudNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports a restored desk with what the cloud copy held', () => {
    seed({
      kind: 'downloaded',
      summary: { soulsLifetime: new Decimal(12345), savedAtWall: Date.now() - 5 * 60_000, fiscalYear: 3, seals: 7 },
    });
    render(<CloudNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Restored your desk from the cloud · 12,345 souls · FY 3 · saved 5 min ago',
    );
  });

  // Uploads leave the player's desk as it was, so they raise no notice at all.
  it.each([
    { kind: 'uploaded' } as Notice,
    { kind: 'kept-local', summary: { soulsLifetime: new Decimal(1), savedAtWall: 0, fiscalYear: 1, seals: 0 } } as Notice,
  ])('shows nothing for an upload ($kind)', (notice) => {
    seed(notice);
    const { container } = render(<CloudNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports a failed sync and says the local desk is safe', () => {
    seed({ kind: 'error' });
    render(<CloudNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Cloud sync failed. Your desk is safe on this device.');
  });

  it('dismisses', () => {
    const dismissCloudNotice = vi.fn();
    seed({ kind: 'error' });
    useGame.setState({ dismissCloudNotice });
    render(<CloudNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissCloudNotice).toHaveBeenCalled();
  });
});
