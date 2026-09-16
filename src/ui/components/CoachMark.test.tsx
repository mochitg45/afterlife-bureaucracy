import { render, screen, fireEvent } from '@testing-library/react';
import { CoachMark } from './CoachMark';

/** A stand-in for the real stamp button, carrying the attribute the coach mark hunts for. */
function withTarget(rect: Partial<DOMRect>) {
  const button = document.createElement('button');
  button.setAttribute('data-coach', 'stamp');
  button.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}), ...rect }) as DOMRect;
  document.body.appendChild(button);
  return button;
}

describe('CoachMark', () => {
  afterEach(() => {
    document.querySelectorAll('[data-coach]').forEach((el) => el.remove());
  });

  it('spotlights the target element and shows the step copy', () => {
    withTarget({ top: 100, left: 40, width: 120, height: 120, bottom: 220, right: 160 });
    const { container } = render(
      <CoachMark target="stamp" title="Stamp the soul." text="Then stamp the next one." stepIndex={0} total={3} onSkip={() => {}} />,
    );
    expect(screen.getByText('Stamp the soul.')).toBeInTheDocument();
    expect(screen.getByText('Then stamp the next one.')).toBeInTheDocument();
    const hole = container.querySelector('.coach-hole') as HTMLElement;
    expect(hole).not.toBeNull();
    expect(hole.style.left).toBe('40px');
    expect(hole.style.top).toBe('100px');
    expect(hole.style.width).toBe('120px');
    expect(container.querySelector('.coach-dim')).toBeNull();
  });

  it('renders the card centred with no hole when the target is none', () => {
    const { container } = render(
      <CoachMark target="none" title="That is the job." text="Souls pay Karma Credits." stepIndex={2} total={3} onSkip={() => {}} />,
    );
    expect(container.querySelector('.coach-hole')).toBeNull();
    expect(container.querySelector('.coach-card')).toHaveClass('centred');
    // The hole's box-shadow does the dimming on the other steps; with no hole, a plain scrim.
    expect(container.querySelector('.coach-dim')).toBeInTheDocument();
  });

  it('renders the card centred when the target is not on screen', () => {
    const { container } = render(
      <CoachMark target="hire" title="Hire Dave." text="Karma Credits pay the staff." stepIndex={1} total={3} onSkip={() => {}} />,
    );
    expect(container.querySelector('.coach-hole')).toBeNull();
    expect(container.querySelector('.coach-card')).toHaveClass('centred');
  });

  it('re-measures the target when the window resizes', () => {
    const button = withTarget({ top: 100, left: 40, width: 120, height: 120, bottom: 220, right: 160 });
    const { container } = render(
      <CoachMark target="stamp" title="Stamp the soul." text="Then stamp the next one." stepIndex={0} total={3} onSkip={() => {}} />,
    );
    button.getBoundingClientRect = () => ({ x: 0, y: 0, width: 60, height: 60, top: 10, left: 12, right: 72, bottom: 70, toJSON: () => ({}) }) as DOMRect;
    fireEvent(window, new Event('resize'));
    const hole = container.querySelector('.coach-hole') as HTMLElement;
    expect(hole.style.left).toBe('12px');
    expect(hole.style.width).toBe('60px');
  });

  it('sits under a target near the top of the screen', () => {
    withTarget({ top: 100, left: 40, width: 120, height: 120, bottom: 220, right: 160 });
    const { container } = render(
      <CoachMark target="stamp" title="Stamp the soul." text="Then stamp the next one." stepIndex={0} total={3} onSkip={() => {}} />,
    );
    const card = container.querySelector('.coach-card') as HTMLElement;
    expect(card).not.toHaveClass('above');
    expect(card.style.top).toBe('236px');
  });

  it('flips above a target that leaves no room under it', () => {
    // jsdom's window is 768 tall; a target ending at 700 has the tab bar and little else below.
    withTarget({ top: 646, left: 262, width: 84, height: 54, bottom: 700, right: 346 });
    const { container } = render(
      <CoachMark target="stamp" title="Hire Dave." text="Karma Credits pay the staff." stepIndex={1} total={3} onSkip={() => {}} />,
    );
    const card = container.querySelector('.coach-card') as HTMLElement;
    expect(card).toHaveClass('above');
    expect(card.style.bottom).toBe(window.innerHeight - 646 + 16 + 'px');
    expect(card.style.top).toBe('');
  });

  it('shows the step counter and calls onSkip', () => {
    const onSkip = vi.fn();
    render(<CoachMark target="none" title="T" text="X" stepIndex={1} total={3} onSkip={onSkip} />);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('lets taps through the overlay but not through the card', () => {
    const { container } = render(<CoachMark target="none" title="T" text="X" stepIndex={0} total={3} onSkip={() => {}} />);
    expect(container.querySelector('.coach-overlay')).toBeInTheDocument();
    expect(container.querySelector('.coach-card')).toBeInTheDocument();
  });
});
