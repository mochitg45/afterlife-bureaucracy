import { render, screen, fireEvent } from '@testing-library/react';
import { Splash } from './Splash';

describe('Splash', () => {
  it('renders the Inata Sun Soft arc text', () => {
    render(<Splash onDone={() => {}} />);
    expect(screen.getByText('INATA SUN SOFT')).toBeInTheDocument();
  });

  it('calls onDone on a click anywhere on the splash', () => {
    const onDone = vi.fn();
    render(<Splash onDone={onDone} />);
    fireEvent.click(screen.getByTestId('splash'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone on its own via the animationend of the stage', () => {
    const onDone = vi.fn();
    render(<Splash onDone={onDone} />);
    fireEvent.animationEnd(screen.getByTestId('splash-stage'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ignores a bubbled animationend from a ray or facet, only the stage element itself', () => {
    const onDone = vi.fn();
    const { container } = render(<Splash onDone={onDone} />);
    const ray = container.querySelector('.splash-ray');
    expect(ray).toBeInTheDocument();
    fireEvent.animationEnd(ray as Element);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('only calls onDone once even if the click and the stage end both fire', () => {
    const onDone = vi.fn();
    render(<Splash onDone={onDone} />);
    fireEvent.click(screen.getByTestId('splash'));
    fireEvent.animationEnd(screen.getByTestId('splash-stage'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
