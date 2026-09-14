import { render, screen, fireEvent } from '@testing-library/react';
import { AuditCeremony } from './AuditCeremony';
import { useGame } from '../../store/game';

describe('AuditCeremony', () => {
  it('renders nothing without a recent audit', () => {
    useGame.setState({ lastAudit: null });
    expect(render(<AuditCeremony />).container).toBeEmptyDOMElement();
  });
  it('shows seals and year, dismisses', () => {
    useGame.setState({ lastAudit: { sealsGained: 4, fiscalYear: 3 } });
    render(<AuditCeremony />);
    expect(screen.getByRole('dialog', { name: /fiscal year audit/i })).toBeInTheDocument();
    expect(screen.getByText(/\+4 karma seals/i)).toBeInTheDocument();
    expect(screen.getByText(/fiscal year 3 begins/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to the office/i }));
    expect(useGame.getState().lastAudit).toBeNull();
  });
});
