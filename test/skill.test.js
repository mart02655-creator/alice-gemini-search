import test from 'node:test';
import assert from 'node:assert/strict';
import { answer } from '../lib/skill.js';
import handler from '../api/alice.js';
const env = { GEMINI_API_KEY: 'test-gemini', SERPER_API_KEY: 'test-serper' };
const request = (command = 'Какая сейчас погода?', state = {}) => ({ version: '1.0', request: { command }, session: { new: false, skill_id: 'test' }, state });
const options = fetcher => ({ fetcher, logger: () => {} });
test('search precedes generation; sources and bounded context returned', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => calls.length === 1
      ? { organic: [{ title: 'Weather', snippet: 'Солнечно', link: 'https://example.com/weather' }] }
      : { candidates: [{ content: { parts: [{ text: 'Солнечно.' }] } }] } };
  };
  const result = await answer(request(), env, options(fetcher));
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /serper/);
  assert.match(calls[1].body.contents.at(-1).parts[0].text, /Солнечно/);
  assert.equal(result.response.text, 'Солнечно.');
  assert.equal(result.response.buttons[0].url, 'https://example.com/weather');
  assert.equal(result.session_state.history.length, 2);
});
test('search error never produces ungrounded answer', async () => {
  let calls = 0;
  const result = await answer(request(), env, options(async () => { calls++; return { ok: false, status: 429 }; }));
  assert.equal(calls, 1);
  assert.match(result.response.text, /квота/);
});
test('deadline cancels stalled request and preserves conversation', async () => {
  const fetcher = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  const result = await answer(request(), env, { ...options(fetcher), budgetMs: 15 });
  assert.match(result.response.text, /не успели/);
});
test('greeting and exit do not call paid APIs', async () => {
  const fetcher = () => { throw new Error('Unexpected API'); };
  assert.match((await answer(request(''), {}, options(fetcher))).response.text, /Привет/);
  assert.equal((await answer(request('выход'), env, options(fetcher))).response.end_session, true);
});
test('empty search and blocked generation return understandable responses', async () => {
  const empty = await answer(request(), env, options(async () => ({ ok: true, json: async () => ({ organic: [] }) })));
  assert.match(empty.response.text, /не вернул/);
  let calls = 0;
  const blocked = await answer(request(), env, options(async () => ({ ok: true, json: async () => ++calls === 1 ? { organic: [{ snippet: 'test' }] } : { promptFeedback: { blockReason: 'SAFETY' } } })));
  assert.match(blocked.response.text, /не удалось/);
});
test('webhook rejects invalid secret, wrong skill and malformed body before API', async () => {
  const old = { ...process.env };
  process.env.WEBHOOK_SECRET = 'x'.repeat(32); process.env.ALICE_SKILL_ID = 'test';
  try {
    for (const [url, body, status] of [
      ['/api/alice?token=wrong', request(), 403],
      [`/api/alice?token=${'x'.repeat(32)}`, { ...request(), session: { new: true, skill_id: 'other' } }, 403],
      [`/api/alice?token=${'x'.repeat(32)}`, '{bad', 400]
    ]) {
      const res = { setHeader() {}, status(s) { this.code = s; return this; }, json(v) { this.body = v; return this; } };
      await handler({ method: 'POST', url, body }, res);
      assert.equal(res.code, status);
    }
  } finally { process.env = old; }
});
