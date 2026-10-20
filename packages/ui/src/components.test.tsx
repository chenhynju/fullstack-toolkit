import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Card, cn } from './index';
describe('shared components', () => {
  it('defaults to a safe non-submit button and forwards accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <Button disabled aria-label="Build">
        Run
      </Button>
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Build"');
    expect(html).toContain('disabled');
  });
  it('supports an explicit submit action and secondary variant', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" variant="secondary">
        Submit
      </Button>
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('border-slate-300');
  });
  it('preserves card contents and merges conflicting utility classes', () => {
    expect(renderToStaticMarkup(<Card aria-label="Summary">Ready</Card>)).toContain('Ready');
    expect(cn('px-4', false, 'px-8')).toBe('px-8');
  });
});
