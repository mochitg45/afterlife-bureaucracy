import { render, screen, fireEvent } from '@testing-library/react';
import { CosmicCeremony } from './CosmicCeremony';
import { useGame } from '../../store/game';

describe('CosmicCeremony', () => {
  it('renders nothing without a recent restructuring', () => {
    useGame.setState({ lastCosmic: null });
    expect(render(<CosmicCeremony />).container).toBeEmptyDOMElement();
  });

  it('announces the clause point and dismisses', () => {
    useGame.setState({ lastCosmic: { pointsGained: 1 } });
    render(<CosmicCeremony />);
    expect(screen.getByRole('dialog', { name: 'Cosmic Restructuring' })).toBeInTheDocument();
    expect(screen.getByText('+1 Clause point')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the office' }));
    expect(useGame.getState().lastCosmic).toBeNull();
  });

  it('cannot be skipped with Escape', () => {
    useGame.setState({ lastCosmic: { pointsGained: 1 } });
    render(<CosmicCeremony />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useGame.getState().lastCosmic).not.toBeNull();
  });
});
