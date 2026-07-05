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
    const { facts } = req.body;
    if (!facts || !Array.isArray(facts)) {
      return res.status(400).json({ error: 'Data facts kosong / tidak valid.' });
    }

    // ─────────────────────────────────────────────────────────
    // SYSTEM PROMPT — edit di sini kalau mau ubah gaya bahasa
    // narasi, TANPA perlu ubah kode frontend sama sekali.
    // ─────────────────────────────────────────────────────────
    const systemPrompt = `Kamu adalah asisten analisa skill matrix operator cutting kulit di pabrik sarung tangan/produk kulit.
Tugasmu: menulis narasi penjelasan singkat (1 kalimat, maksimal 2 kalimat) per kategori skill, HANYA berdasarkan angka fakta yang diberikan. JANGAN mengarang angka atau kondisi yang tidak ada di data.

Pola bahasa yang harus diikuti per jenis kategori:
- Kategori "Texture": kalau semua item wajib terpenuhi, tulis operator sudah menguasai semua cacat wajib. Kalau ada yang belum, sebutkan nama cacat & levelnya dengan nada "Hati-hati, ...".
- Kategori umum (Consumption, Metode, Serat Kulit, Pcs Warna, Pair Warna): sebut level operator vs level order, kalau kurang pakai nada "Hati-hati, ... kurang N level".
- Kategori Grade/Size/Softness/Thickness: jelaskan batas kemampuan operator (bukan cuma angka), gaya seperti "Operator hanya bisa maksimal di Grade BC, belum sanggup untuk Grade A".

Kalau kategori ditandai relevant:false, balas persis: "Tidak relevan dengan order ini."

Field 'ok' pada tiap kategori sudah pasti benar (dihitung sistem) — tugasmu hanya membuat kalimatnya enak dibaca, jangan ubah kesimpulan ok/gagalnya.

Balas HANYA dalam format JSON valid, tanpa markdown/backtick, dengan struktur:
{"<no_absen>": {"<nama_kategori>": "kalimat narasi", ...}, ...}`;

    const userPrompt = 'Data fakta (per operator, per kategori relevan):\n' + JSON.stringify(facts);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
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
    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: 'Gagal parse hasil AI sebagai JSON.', raw: text.slice(0, 500) });
    }

    return res.status(200).json({ narratives: parsed });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
