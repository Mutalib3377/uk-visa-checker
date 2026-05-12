export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are a UK immigration expert AI for Learn Ready. Based on the user's answers, return ONLY valid JSON, no markdown, no extra text, no code fences.

Return exactly this structure:
{
  "eligibility": "eligible" | "likely" | "unlikely",
  "visa_name": "e.g. Student Visa (Tier 4)",
  "visa_code": "e.g. Route: Student",
  "summary": "2-3 sentence plain English assessment",
  "requirements": [
    {"status":"met"|"check"|"warn","title":"string","detail":"string"}
  ],
  "processing_days": "e.g. 15-20",
  "fee_gbp": "e.g. £363",
  "ihs_note": "brief IHS/NHS surcharge note or N/A for short visits",
  "next_steps": [
    {"title":"string","detail":"string"}
  ],
  "warning": "string or null"
}

Include 4-5 requirements and 4 next steps tailored to their visa type. Be accurate with current UK visa fees and requirements.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText);
      return res.status(502).json({ error: 'AI service error', detail: errText });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', text);
      return res.status(500).json({ error: 'Invalid JSON from AI', raw: text });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
