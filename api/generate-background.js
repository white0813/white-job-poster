import { generateText } from 'ai';

const MODEL = 'google/gemini-3.1-flash-image';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  try {
    const { prompt } = req.body || {};
    if (typeof prompt !== 'string' || prompt.length < 20 || prompt.length > 1800) {
      return res.status(400).json({ error: '背景描述格式不正確' });
    }
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
      return res.status(503).json({ error: '尚未設定 AI Gateway 金鑰' });
    }

    const result = await generateText({ model: MODEL, prompt, maxRetries: 1 });
    const file = result.files?.find((item) => item.mediaType?.startsWith('image/'));
    if (!file) {
      return res.status(502).json({ error: 'AI 沒有回傳圖片，請再試一次' });
    }

    const base64 = Buffer.from(file.uint8Array).toString('base64');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      image: `data:${file.mediaType};base64,${base64}`,
    });
  } catch (error) {
    console.error('Background generation failed:', error);
    return res.status(500).json({ error: '背景生成暫時失敗，請稍後再試，並確認 AI Gateway 額度與金鑰。' });
  }
}
