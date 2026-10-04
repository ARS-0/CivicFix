const raw = process.env.AI_SERVICE_URL || '';
const URL_ = raw && !/^https?:\/\//.test(raw) ? `http://${raw}` : raw;

export async function analyzeImage(buffer) {
  try {
    if (!URL_) throw new Error('AI_SERVICE_URL not set');
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
    const res = await fetch(`${URL_}/analyze`, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    return await res.json();
  } catch (e) {
    if (URL_) console.error('AI analysis unavailable:', e.message);
    return {
      category: 'other', confidence: 0, severity: 5, near_public_zone: false, provider: 'unavailable',
      title: 'Reported issue', description: 'Automatic analysis is unavailable. Please choose a category and describe the problem.', details: [],
    };
  }
}
