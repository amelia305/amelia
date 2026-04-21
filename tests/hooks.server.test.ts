import { describe, it, expect, vi } from 'vitest';
import { handle } from '../src/hooks.server';

describe('hooks.server.ts', () => {
  it('sets locals.user to null and calls resolve', async () => {
    const resolve = vi.fn(async () => new Response('ok'));
    const event = { locals: {} } as Parameters<typeof handle>[0]['event'];

    await handle({ event, resolve });

    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
  });
});
