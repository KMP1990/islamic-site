/* ============================================
   Netlify Function — إرسال Push عبر OneSignal
   يُخفي REST Key عن الـ frontend
   ============================================ */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || 'a666e4cb-b2ed-49aa-8dd9-46f0cf962e3a';
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!ONESIGNAL_REST_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ONESIGNAL_REST_KEY not configured' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { toUid, title, body: msgBody, type, chatId, link, fromName } = body;

    if (!toUid || !title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'toUid and title are required' })
      };
    }

    // Rate limiting بسيط
    const now = Date.now();
    global.__rateLimit = global.__rateLimit || new Map();
    const lastSent = global.__rateLimit.get(toUid) || 0;
    if (now - lastSent < 3000) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Too many requests' })
      };
    }
    global.__rateLimit.set(toUid, now);

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [String(toUid)] },
      target_channel: 'push',
      headings: { en: title, ar: title },
      contents: { en: msgBody || '', ar: msgBody || '' },
      data: {
        type: type || 'general',
        chatId: chatId || null,
        link: link || null,
        fromName: fromName || null
      },
      priority: 10,
      ttl: 86400
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    return {
      statusCode: response.ok ? 200 : 500,
      headers,
      body: JSON.stringify({
        ok: response.ok,
        id: result.id || null,
        recipients: result.recipients || 0,
        error: result.errors ? result.errors.join(', ') : null
      })
    };
  } catch (err) {
    console.error('[send-push] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};