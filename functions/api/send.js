import { vapidHeaders } from '@block65/webcrypto-web-push';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
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

    if (!site_key || !vapid || !subscription || !payload) {
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

    const encoder = new TextEncoder();
    const payloadData = encoder.encode(JSON.stringify(payload));

    const vapidHeadersResult = await vapidHeaders(subscription, {
      subject: vapid.subject,
      publicKey: vapid.public_key,
      privateKey: vapid.private_key,
    });

    const userPublicKey = base64UrlToUint8Array(subscription.keys.p256dh);
    const authSecret = base64UrlToUint8Array(subscription.keys.auth);

    const encryptedPayload = await encryptPayload(
      userPublicKey,
      authSecret,
      payloadData
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': vapidHeadersResult.headers.authorization,
        'Crypto-Key': vapidHeadersResult.headers['crypto-key'],
        'TTL': '86400',
      },
      body: encryptedPayload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ 
        error: `Push service error: ${response.status}`,
        details: errorText
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Push notification sent successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
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