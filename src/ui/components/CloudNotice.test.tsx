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

  it('reports an upload of the newer local desk', () => {
    seed({ kind: 'uploaded' });
    render(<CloudNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('This device had the newer desk; uploaded it.');
  });

  // A conflict resolved in the local save's favour is the same news to the player as a plain
  // upload: the desk they are looking at is the one that won.
  it('reports a kept-local conflict the same way', () => {
    seed({ kind: 'kept-local', summary: { soulsLifetime: new Decimal(1), savedAtWall: 0, fiscalYear: 1, seals: 0 } });
    render(<CloudNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('This device had the newer desk; uploaded it.');
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
