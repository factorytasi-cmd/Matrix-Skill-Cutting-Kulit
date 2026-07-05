export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key belum dikonfigurasi di Vercel Environment Variables.' });
  }

  try {
    const { question, context } = req.body;
    if (!question) return res.status(400).json({ error: 'Pertanyaan kosong.' });

    const systemPrompt = `Kamu adalah asisten LITRA-ASI untuk dashboard skill matrix operator cutting kulit.
Jawab HANYA berdasarkan data hasil pencocokan (context) yang diberikan — jangan mengarang nama operator atau angka yang tidak ada di context.
Kalau context kosong (belum ada order yang dicek), arahkan user untuk membuka tab "Cek Kelayakan" dulu.
Jawab singkat, langsung ke inti, bahasa Indonesia santai tapi profesional, maksimal 4-5 kalimat.`;

    const userPrompt = 'Context hasil pencocokan (JSON):\n' + JSON.stringify(context || {}) + '\n\nPertanyaan user: ' + question;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${errText.slice(0, 300)}` });
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');
    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
