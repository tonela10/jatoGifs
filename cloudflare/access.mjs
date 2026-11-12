const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Invalid JWT segment');
  return Uint8Array.from(atob(segment.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

export async function isAdmin(request, env, fetcher = fetch) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const issuer = env.ACCESS_ISSUER;
  if (!token || token.length > 8192 || !env.ACCESS_AUD || !env.ADMIN_EMAIL ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '')) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [head, body, signature] = parts;
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(decode(head)));
    const claim = JSON.parse(decoder.decode(decode(body)));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
        claim.iss !== issuer || claim.type !== 'app' || !Array.isArray(claim.aud) ||
        !claim.aud.includes(env.ACCESS_AUD) || !Number.isFinite(claim.exp) || claim.exp <= now ||
        (claim.nbf !== undefined && (!Number.isFinite(claim.nbf) || claim.nbf > now)) ||
        typeof claim.email !== 'string' || claim.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return false;
    const response = await fetcher(issuer + '/cdn-cgi/access/certs', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const { keys } = await response.json();
    const jwk = keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
    return await crypto.subtle.verify(algorithm.name, key, decode(signature), new TextEncoder().encode(head + '.' + body));
  } catch {
    return false;
  }
}
