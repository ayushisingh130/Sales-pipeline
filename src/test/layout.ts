import { vi } from 'vitest';

/**
 * jsdom has no layout, so the virtualizer would render no rows. This gives elements a size,
 * a scrollable height and a working scrollTo. Call it in beforeEach; `restoreMocks` undoes the spies.
 */
export function mockLayout({ height = 400, width = 1000 } = {}) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  // The virtualizer clamps scroll targets to scrollHeight, which jsdom always reports as 0.
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(1_000_000);
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options === 'object') this.scrollTop = options.top ?? this.scrollTop;
    this.dispatchEvent(new Event('scroll'));
  } as Element['scrollTo'];
}
