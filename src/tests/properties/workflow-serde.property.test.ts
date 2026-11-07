import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import * as F from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterChatLanguageModel } from '../../chat';
import { OpenRouterCompletionLanguageModel } from '../../completion';
import { createOpenRouter } from '../../provider';
import { log, runs } from './harness';

const caseVariants = (name: string) =>
  F.array(F.boolean(), { minLength: name.length, maxLength: name.length }).map(
    (bs: boolean[]) =>
      name
        .split('')
        .map((ch, i) => (bs[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(''),
  );
const secretName = F.oneof(
  caseVariants('authorization'),
  caseVariants('x-provider-api-keys'),
  caseVariants('proxy-authorization'),
  caseVariants('cookie'),
  caseVariants('x-api-key'),
  F.stringMatching(/^X-[A-Za-z]{1,8}$/),
);
const allowName = F.oneof(
  caseVariants('x-openrouter-title'),
  caseVariants('http-referer'),
);
const secret = F.stringMatching(/^[a-z0-9]{6,12}$/).map(
  (s: string) => `SECRET_${s}`,
);
const plain = F.stringMatching(/^[a-z ]{0,10}$/).map((s: string) => `pub ${s}`);
const baseURL = F.oneof(
  F.constant(undefined),
  F.constantFrom(
    'https://a.example.com/api/v1',
    'https://a.example.com/api/v1/',
    'http://localhost:8080',
    'http://localhost:8080/',
    'https://a.example.com/x?y=1',
    'https://a.example.com/api/v1//',
  ),
);

const optionsArb = F.record(
  {
    apiKey: secret,
    api_keys: F.option(
      F.dictionary(F.constantFrom('anthropic', 'openai'), secret, {
        maxKeys: 2,
      }),
      { nil: undefined },
    ),
    secretHeaders: F.dictionary(secretName, secret, { maxKeys: 4 }),
    allowHeaders: F.dictionary(allowName, plain, { maxKeys: 2 }),
    appName: F.option(plain, { nil: undefined }),
    appUrl: F.option(plain, { nil: undefined }),
    baseURL,
    useBaseUrlAlias: F.boolean(),
    extraBody: F.option(
      F.jsonValue({ maxDepth: 2 }).map((v: unknown) =>
        JSON.parse(JSON.stringify({ x: v })),
      ),
      { nil: undefined },
    ),
    compatibility: F.option(F.constantFrom('strict', 'compatible'), {
      nil: undefined,
    }),
    kind: F.constantFrom('chat', 'completion'),
    settingsExtra: F.option(
      F.jsonValue({ maxDepth: 2 }).map((v: unknown) =>
        JSON.parse(JSON.stringify({ v })),
      ),
      { nil: undefined },
    ),
  },
  {
    requiredKeys: [
      'apiKey',
      'secretHeaders',
      'allowHeaders',
      'kind',
      'useBaseUrlAlias',
    ],
  },
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function capture() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f = async (url: any, init: any) => {
    const h: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => {
      h[k] = v;
    });
    calls.push({ url: String(url), headers: h });
    return new Response('{"error":{"message":"x","code":400}}', {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, f };
}

describe('workflow serde properties', () => {
  it('payload safe, no secrets, same URL, allowlist headers survive', async () => {
    let n = 0;
    await F.assert(
      F.asyncProperty(optionsArb, async (o: any) => {
        n++;
        vi.stubEnv('OPENROUTER_API_KEY', 'ENVKEY');
        const orig = capture();
        const headers = { ...o.secretHeaders, ...o.allowHeaders };
        const provider = createOpenRouter({
          apiKey: o.apiKey,
          api_keys: o.api_keys,
          headers,
          appName: o.appName,
          appUrl: o.appUrl,
          ...(o.useBaseUrlAlias
            ? { baseUrl: o.baseURL }
            : { baseURL: o.baseURL }),
          extraBody: o.extraBody,
          compatibility: o.compatibility,
          fetch: orig.f as any,
        });
        const settings: any = o.settingsExtra
          ? { user: 'u', extraBody: o.settingsExtra }
          : {};
        const Cls: any =
          o.kind === 'chat'
            ? OpenRouterChatLanguageModel
            : OpenRouterCompletionLanguageModel;
        const model: any =
          o.kind === 'chat'
            ? provider.chat('m/x', settings)
            : provider.completion('m/x', settings);
        const payload = Cls[WORKFLOW_SERIALIZE](model);

        // structuredClone + JSON safe
        const cloned = structuredClone(payload);
        expect(cloned).toEqual(payload);
        expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
        // no secrets
        const text = JSON.stringify(payload);
        expect(text).not.toMatch(/SECRET_/);

        const restored: any = Cls[WORKFLOW_DESERIALIZE](cloned);
        const rest = capture();
        vi.stubGlobal('fetch', rest.f);
        const prompt: any = [
          { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        ];
        const byok = o.api_keys && Object.keys(o.api_keys).length > 0;
        const userSetsProviderKeysHeader = Object.keys(o.secretHeaders).some(
          (k) => k.toLowerCase() === 'x-provider-api-keys',
        );
        for (const fn of ['doGenerate', 'doStream']) {
          await model[fn]({ prompt }).catch(() => {});
          const r = await restored[fn]({ prompt }).then(
            () => 'ok',
            (e: any) => e,
          );
          if (byok || userSetsProviderKeysHeader) {
            expect(String(r?.message)).toMatch(/BYOK/);
            continue;
          }
          const a = orig.calls.at(-1)!;
          const b = rest.calls.at(-1)!;
          expect(b.url).toBe(a.url);
          for (const k of ['x-openrouter-title', 'http-referer']) {
            expect(b.headers[k]).toBe(a.headers[k]);
          }
          expect(b.headers.authorization).toBe('Bearer ENVKEY');
          expect(JSON.stringify(b.headers)).not.toMatch(/SECRET_/);
        }
        // also compare url builder directly for random paths
        for (const path of [
          '/chat/completions',
          '/completions',
          '',
          '/x/y?z=1',
        ]) {
          expect(restored.config.url({ path, modelId: 'm/x' })).toBe(
            model.config.url({ path, modelId: 'm/x' }),
          );
        }
      }),
      { numRuns: runs('SERDE_RUNS', 500), seed: 3 },
    );
    log(`SERDE cases=${n}`);
  });
});
