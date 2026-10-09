export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const ready = ['GEMINI_API_KEY', 'SERPER_API_KEY', 'ALICE_SKILL_ID'].every(k => Boolean(process.env[k])) && (process.env.WEBHOOK_SECRET?.length || 0) >= 32;
  return res.status(ready ? 200 : 503).json({ status: ready ? 'configured' : 'not_configured', api_connectivity: 'not_checked' });
}
