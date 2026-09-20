import { render } from '@testing-library/react';
import { StoreArt } from './StoreArt';
import { PRODUCT_IDS } from '../../platform/billing';

describe('StoreArt', () => {
  it('renders a distinct SVG tagged with data-product for every product id', () => {
    const markup = PRODUCT_IDS.map((id) => {
      const { container } = render(<StoreArt productId={id} />);
      const svg = container.querySelector(`svg[data-product="${id}"]`);
      expect(svg).toBeInTheDocument();
      return svg!.innerHTML;
    });
    expect(new Set(markup).size).toBe(PRODUCT_IDS.length);
  });
});
