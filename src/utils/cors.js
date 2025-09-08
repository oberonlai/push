export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request, allowedOrigins = ['*']) {
  const origin = request.headers.get('Origin');
  
  if (allowedOrigins.includes('*')) {
    return corsHeaders('*');
  }
  
  if (origin && allowedOrigins.includes(origin)) {
    return corsHeaders(origin);
  }
  
  return corsHeaders(allowedOrigins[0]);
}

export function createResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...headers,
    },
  });
}

export function createErrorResponse(error, status = 400) {
  return createResponse({ error }, status);
}