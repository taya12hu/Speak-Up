import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, generateTopics, getSessions } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (impl: () => Promise<Response>) => {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('api client', () => {
  it('posts JSON to a same-origin /api path', async () => {
    const fetchMock = stubFetch(async () => Response.json(['a topic']));
    await expect(generateTopics({ category: 'general', difficulty: 'Easy', count: 1 })).resolves.toEqual(['a topic']);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/topics');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ category: 'general', difficulty: 'Easy', count: 1 });
  });

  it("surfaces the server's error message and status", async () => {
    stubFetch(async () => Response.json({ error: 'Gemini rate limit reached' }, { status: 429 }));
    const err = await getSessions().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, message: 'Gemini rate limit reached' });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    stubFetch(async () => new Response('<html>Bad Gateway</html>', { status: 502 }));
    await expect(getSessions()).rejects.toThrow('The server ran into a problem. Check the server logs.');
  });

  it('reports an unreachable server distinctly', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(getSessions()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Could not reach the server') });
  });
});
