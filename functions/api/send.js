import { buildPushPayload } from '@block65/webcrypto-web-push';

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = Math.random().toString(36).substring(2, 8);
  
  console.log(`[${requestId}] === 新推播請求開始 ===`);

  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.log(`[${requestId}] ❌ Content-Type 錯誤:`, contentType);
      return new Response(JSON.stringify({ 
        error: 'Content-Type must be application/json' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const body = await request.json();
    const { site_key, vapid, subscription, payload } = body;
    
    console.log(`[${requestId}] 📋 請求資料:`, {
      site_key,
      vapid_subject: vapid?.subject,
      subscription_endpoint: subscription?.endpoint,
      payload_title: payload?.title
    });

    if (!site_key || !vapid || !subscription || !payload) {
      console.log(`[${requestId}] ❌ 缺少必要欄位`);
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: site_key, vapid, subscription, payload' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    if (!vapid.subject || !vapid.public_key || !vapid.private_key) {
      console.log(`[${requestId}] ❌ VAPID 設定不完整`);
      return new Response(JSON.stringify({ 
        error: 'Invalid VAPID configuration. Required: subject, public_key, private_key' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const allowedSiteKeys = env.ALLOWED_SITE_KEYS ? env.ALLOWED_SITE_KEYS.split(',') : null;
    if (allowedSiteKeys && !allowedSiteKeys.includes(site_key)) {
      console.log(`[${requestId}] ❌ Site key 驗證失敗:`, { site_key, allowed: allowedSiteKeys });
      return new Response(JSON.stringify({ 
        error: 'Invalid site key' 
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    console.log(`[${requestId}] ✅ Site key 驗證通過:`, site_key);

    // 使用 buildPushPayload 建構推播請求
    console.log(`[${requestId}] 🔨 建構推播 payload...`);
    let pushPayload;
    try {
      const vapidKeys = {
        subject: vapid.subject,
        publicKey: vapid.public_key,
        privateKey: vapid.private_key,
      };

      pushPayload = await buildPushPayload(
        { data: JSON.stringify(payload) }, // message
        subscription, // subscription
        vapidKeys // vapid keys
      );
      
      console.log(`[${requestId}] ✅ 推播 payload 建構成功`);
      console.log(`[${requestId}] 📤 請求方法:`, pushPayload.method);
      console.log(`[${requestId}] 📋 請求標頭:`, pushPayload.headers);
      console.log(`[${requestId}] 📦 Body 大小:`, pushPayload.body ? pushPayload.body.byteLength : 0, 'bytes');
      
    } catch (e) {
      console.log(`[${requestId}] ❌ 建構推播 payload 失敗:`, e.message);
      console.log(`[${requestId}] 錯誤詳情:`, e.stack);
      return new Response(JSON.stringify({ 
        error: 'Failed to build push payload',
        details: e.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 發送推播請求
    console.log(`[${requestId}] 🚀 發送推播到:`, subscription.endpoint);

    const response = await fetch(subscription.endpoint, pushPayload);

    console.log(`[${requestId}] 📨 推播回應狀態:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[${requestId}] ❌ 推播失敗:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return new Response(JSON.stringify({ 
        error: `Push service error: ${response.status}`,
        details: errorText,
        endpoint: subscription.endpoint
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const responseText = await response.text();
    console.log(`[${requestId}] ✅ 推播成功！回應:`, responseText);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Push notification sent successfully',
      endpoint: subscription.endpoint,
      request_id: requestId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error(`[${requestId}] 💥 推播發生錯誤:`, error);
    console.error(`[${requestId}] 錯誤堆疊:`, error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      request_id: requestId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}