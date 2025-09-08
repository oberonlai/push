import { generateAuthenticationHeader } from '@block65/webcrypto-web-push';

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

    // 處理 payload 加密
    const encoder = new TextEncoder();
    const payloadData = encoder.encode(JSON.stringify(payload));
    console.log(`[${requestId}] 📦 Payload 大小:`, payloadData.length, 'bytes');

    // 解碼 VAPID 金鑰
    let privateKeyData, publicKeyData;
    try {
      privateKeyData = base64UrlToUint8Array(vapid.private_key);
      publicKeyData = base64UrlToUint8Array(vapid.public_key);
      console.log(`[${requestId}] 🔑 VAPID 金鑰解碼成功`, {
        private_key_length: privateKeyData.length,
        public_key_length: publicKeyData.length
      });
    } catch (e) {
      console.log(`[${requestId}] ❌ VAPID 金鑰解碼失敗:`, e.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid VAPID key format',
        details: e.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 導入私鑰
    let privateKey;
    try {
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyData,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['sign']
      );
      console.log(`[${requestId}] 🔐 私鑰導入成功`);
    } catch (e) {
      console.log(`[${requestId}] ❌ 私鑰導入失敗:`, e.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid private key',
        details: e.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 生成 VAPID 認證標頭
    let authHeader;
    try {
      authHeader = await generateAuthenticationHeader({
        endpoint: subscription.endpoint,
        subject: vapid.subject,
        publicKey: publicKeyData,
        privateKey: privateKey,
        expiration: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
      });
      console.log(`[${requestId}] 🎫 VAPID 認證標頭生成成功`);
    } catch (e) {
      console.log(`[${requestId}] ❌ VAPID 認證標頭生成失敗:`, e.message);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate VAPID auth header',
        details: e.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 解碼訂閱金鑰
    let userPublicKey, authSecret;
    try {
      userPublicKey = base64UrlToUint8Array(subscription.keys.p256dh);
      authSecret = base64UrlToUint8Array(subscription.keys.auth);
      console.log(`[${requestId}] 🔑 訂閱金鑰解碼成功`, {
        p256dh_length: userPublicKey.length,
        auth_length: authSecret.length
      });
    } catch (e) {
      console.log(`[${requestId}] ❌ 訂閱金鑰解碼失敗:`, e.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid subscription keys',
        details: e.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 加密 payload
    let encryptedPayload;
    try {
      encryptedPayload = await encryptPayload(userPublicKey, authSecret, payloadData);
      console.log(`[${requestId}] 🔒 Payload 加密成功，大小:`, encryptedPayload.length, 'bytes');
    } catch (e) {
      console.log(`[${requestId}] ❌ Payload 加密失敗:`, e.message);
      return new Response(JSON.stringify({ 
        error: 'Failed to encrypt payload',
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
    const pushHeaders = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': authHeader,
      'TTL': '86400',
    };
    console.log(`[${requestId}] 📤 推播請求標頭:`, pushHeaders);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: pushHeaders,
      body: encryptedPayload,
    });

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

function base64UrlToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function encryptPayload(userPublicKey, authSecret, payload) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const serverKeyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.importKey(
    'raw',
    userPublicKey,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    serverKeyPair.privateKey,
    256
  );

  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk = await hkdf(new Uint8Array(sharedSecret), authSecret, authInfo, 32);

  const serverPublicKey = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const context = concatArrays(
    new TextEncoder().encode('P-256\0'),
    new Uint8Array([0, 65]),
    new Uint8Array(userPublicKey),
    new Uint8Array([0, 65]),
    new Uint8Array(serverPublicKey)
  );

  const contentEncryptionKeyInfo = concatArrays(
    new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    context
  );
  const contentEncryptionKey = await hkdf(prk, salt, contentEncryptionKeyInfo, 16);

  const nonceInfo = concatArrays(
    new TextEncoder().encode('Content-Encoding: nonce\0'),
    context
  );
  const nonce = await hkdf(prk, salt, nonceInfo, 12);

  const paddingLength = 0;
  const paddedPayload = concatArrays(
    payload,
    new Uint8Array([2]),
    new Uint8Array(paddingLength)
  );

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
    },
    await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']),
    paddedPayload
  );

  const header = concatArrays(
    salt,
    new Uint8Array([0, 0, 16, 0]),
    new Uint8Array([65]),
    new Uint8Array(serverPublicKey)
  );

  return concatArrays(header, new Uint8Array(encryptedData));
}

async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: info,
    },
    key,
    length * 8
  );

  return new Uint8Array(bits);
}

function concatArrays(...arrays) {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}