import { answer, authorized } from '../lib/skill.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const env = process.env;
  const token = new URL(req.url, 'https://localhost').searchParams.get('token');
  if (!authorized(token, env.WEBHOOK_SECRET)) return res.status(403).json({ error: 'forbidden' });
  if (!env.ALICE_SKILL_ID) return res.status(503).json({ error: 'skill_not_configured' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_json' }); } }
  if (!body || body.version !== '1.0' || typeof body.request?.command !== 'string' || body.request.command.length > 1000 || !body.session || typeof body.session.new !== 'boolean')
    return res.status(400).json({ error: 'invalid_request' });
  if (body.session.skill_id !== env.ALICE_SKILL_ID) return res.status(403).json({ error: 'wrong_skill' });
  try { return res.status(200).json(await answer(body, env)); }
  catch { console.info(JSON.stringify({ event: 'failure', code: 'handler' })); return res.status(500).json({ error: 'internal' }); }
}
