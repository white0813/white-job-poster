import { generateText } from 'ai';

const MODEL = 'google/gemini-3.1-flash-image-preview';

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
    const upstreamStatus = Number(error?.statusCode || error?.status || error?.response?.status || 0);
    const errorType = String(error?.name || 'UnknownError').slice(0, 80);
    console.error('Background generation failed:', {
      name: errorType,
      status: upstreamStatus || null,
      message: String(error?.message || 'Unknown error').slice(0, 300),
    });

    let hint = '服務暫時異常，請稍後再試';
    if (upstreamStatus === 401 || upstreamStatus === 403) hint = 'AI Gateway 金鑰驗證失敗，請檢查 Vercel 環境變數';
    else if (upstreamStatus === 402) hint = 'AI Gateway 額度不足或預算已用完';
    else if (upstreamStatus === 404) hint = 'AI 圖片模型不存在或目前無法使用';
    else if (upstreamStatus === 429) hint = 'AI 請求過於頻繁，請稍後再試';
    else if (upstreamStatus >= 500) hint = 'AI 模型服務暫時無法使用';

    return res.status(502).json({
      error: '背景生成失敗：' + hint,
      diagnostic: { type: errorType, upstreamStatus: upstreamStatus || null },
    });
  }
}
