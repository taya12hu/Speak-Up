import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, configureApiAuth, deleteSession, generateTopics, getSessions, transcribeAudio, type ApiAuth } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  configureApiAuth(null);
});

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const authHeader = (init: RequestInit | undefined) => new Headers(init?.headers).get('Authorization');

function fakeAuth(overrides: Partial<ApiAuth> = {}) {
  const auth = {
    getAccessToken: vi.fn(async () => 'token-1'),
    refreshAccessToken: vi.fn(async () => 'token-2'),
    onSessionExpired: vi.fn(),
    ...overrides,
  };
  configureApiAuth(auth);
  return auth;
}

describe('api client', () => {
  it('posts JSON to a same-origin /api path', async () => {
    const fetchMock = stubFetch(async () => Response.json(['a topic']));
    await expect(generateTopics({ category: 'general', difficulty: 'Easy', count: 1 })).resolves.toEqual(['a topic']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/topics');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ category: 'general', difficulty: 'Easy', count: 1 });
  });

  it("surfaces the server's error message, status and code", async () => {
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

  it('handles 204 No Content (session delete)', async () => {
    const fetchMock = stubFetch(async () => new Response(null, { status: 204 }));
    await expect(deleteSession('5f0c1a1e-0000-4000-8000-000000000000')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sessions/5f0c1a1e-0000-4000-8000-000000000000');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});

describe('api client authentication', () => {
  it('sends the access token as a Bearer header', async () => {
    fakeAuth();
    const fetchMock = stubFetch(async () => Response.json([]));
    await getSessions();
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe('Bearer token-1');
  });

  it('sends no Authorization header when signed out', async () => {
    fakeAuth({ getAccessToken: vi.fn(async () => null) });
    const fetchMock = stubFetch(async () => Response.json([]));
    await getSessions();
    expect(authHeader(fetchMock.mock.calls[0][1])).toBeNull();
  });

  it('refreshes an expired token once and retries the request', async () => {
    const getAccessToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce('stale-token').mockResolvedValue('token-2');
    const auth = fakeAuth({ getAccessToken });
    let calls = 0;
    const fetchMock = stubFetch(async () =>
      ++calls === 1 ? Response.json({ error: 'expired', code: 'token_expired' }, { status: 401 }) : Response.json([{ id: 's1' }]),
    );

    await expect(getSessions()).resolves.toEqual([{ id: 's1' }]);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authHeader(fetchMock.mock.calls[1][1])).toBe('Bearer token-2');
    expect(auth.onSessionExpired).not.toHaveBeenCalled();
  });

  it('ends the session when the refresh fails, without retrying', async () => {
    const auth = fakeAuth({ refreshAccessToken: vi.fn(async () => null) });
    const fetchMock = stubFetch(async () => Response.json({ error: 'Your session has expired.', code: 'token_expired' }, { status: 401 }));

    await expect(getSessions()).rejects.toMatchObject({ status: 401, code: 'token_expired' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(auth.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('retries at most once, even if the server keeps rejecting the new token', async () => {
    const auth = fakeAuth();
    const fetchMock = stubFetch(async () => Response.json({ error: 'invalid', code: 'token_invalid' }, { status: 401 }));

    await expect(getSessions()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on errors that are not about the token', async () => {
    const auth = fakeAuth();
    stubFetch(async () => Response.json({ error: 'Practice history is temporarily unavailable.', code: 'db_unavailable' }, { status: 503 }));

    await expect(getSessions()).rejects.toMatchObject({ status: 503, code: 'db_unavailable' });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.onSessionExpired).not.toHaveBeenCalled();
  });

  it('resends a multipart upload body on retry', async () => {
    fakeAuth();
    const bodies: unknown[] = [];
    let calls = 0;
    stubFetch(async (_url, init) => {
      bodies.push(init.body);
      return ++calls === 1 ? Response.json({ error: 'expired', code: 'token_expired' }, { status: 401 }) : Response.json({ ok: true });
    });
    await transcribeAudio(new Blob(['RIFF']));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBeInstanceOf(FormData);
  });
});
