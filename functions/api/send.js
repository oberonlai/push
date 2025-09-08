import { buildPushPayload } from '@block65/webcrypto-web-push';

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

    const vapidKeys = {
      subject: vapid.subject,
      publicKey: vapid.public_key,
      privateKey: vapid.private_key,
    };

    const pushPayload = await buildPushPayload(
      { data: JSON.stringify(payload) },
      subscription,
      vapidKeys
    );

    const response = await fetch(subscription.endpoint, pushPayload);

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