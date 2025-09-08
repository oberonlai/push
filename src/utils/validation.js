export function validateSiteKey(siteKey, allowedKeys) {
  if (!allowedKeys || allowedKeys.length === 0) {
    return true;
  }
  return allowedKeys.includes(siteKey);
}

export function validateVapidKeys(vapid) {
  if (!vapid || typeof vapid !== 'object') {
    return { valid: false, error: 'VAPID configuration is required' };
  }

  if (!vapid.subject) {
    return { valid: false, error: 'VAPID subject is required (e.g., mailto:admin@example.com)' };
  }

  if (!vapid.subject.startsWith('mailto:') && !vapid.subject.startsWith('https://')) {
    return { valid: false, error: 'VAPID subject must start with mailto: or https://' };
  }

  if (!vapid.public_key || typeof vapid.public_key !== 'string') {
    return { valid: false, error: 'VAPID public_key is required and must be a string' };
  }

  if (!vapid.private_key || typeof vapid.private_key !== 'string') {
    return { valid: false, error: 'VAPID private_key is required and must be a string' };
  }

  try {
    const publicKeyLength = base64UrlDecode(vapid.public_key).length;
    if (publicKeyLength !== 65) {
      return { valid: false, error: 'Invalid VAPID public key length' };
    }
  } catch (e) {
    return { valid: false, error: 'Invalid VAPID public key format' };
  }

  try {
    base64UrlDecode(vapid.private_key);
  } catch (e) {
    return { valid: false, error: 'Invalid VAPID private key format' };
  }

  return { valid: true };
}

export function validateSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') {
    return { valid: false, error: 'Subscription object is required' };
  }

  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
    return { valid: false, error: 'Subscription endpoint is required' };
  }

  if (!subscription.endpoint.startsWith('https://')) {
    return { valid: false, error: 'Subscription endpoint must use HTTPS' };
  }

  if (!subscription.keys || typeof subscription.keys !== 'object') {
    return { valid: false, error: 'Subscription keys object is required' };
  }

  if (!subscription.keys.p256dh || typeof subscription.keys.p256dh !== 'string') {
    return { valid: false, error: 'Subscription keys.p256dh is required' };
  }

  if (!subscription.keys.auth || typeof subscription.keys.auth !== 'string') {
    return { valid: false, error: 'Subscription keys.auth is required' };
  }

  try {
    base64UrlDecode(subscription.keys.p256dh);
  } catch (e) {
    return { valid: false, error: 'Invalid subscription keys.p256dh format' };
  }

  try {
    base64UrlDecode(subscription.keys.auth);
  } catch (e) {
    return { valid: false, error: 'Invalid subscription keys.auth format' };
  }

  return { valid: true };
}

export function validatePayload(payload) {
  if (payload === null || payload === undefined) {
    return { valid: false, error: 'Payload is required' };
  }

  if (typeof payload === 'object') {
    if (!payload.title && !payload.body) {
      return { valid: false, error: 'Payload must contain at least title or body' };
    }
  }

  const payloadString = JSON.stringify(payload);
  const payloadSize = new TextEncoder().encode(payloadString).length;
  
  if (payloadSize > 4096) {
    return { valid: false, error: `Payload size (${payloadSize} bytes) exceeds maximum allowed (4096 bytes)` };
  }

  return { valid: true };
}

function base64UrlDecode(base64String) {
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