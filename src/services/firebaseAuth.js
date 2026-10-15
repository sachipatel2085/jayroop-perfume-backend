/**
 * Verifies Firebase Authentication ID tokens (Google sign-in) without the firebase-admin SDK.
 *
 * Firebase ID tokens are RS256 JWTs signed by Google. We check them exactly the way the Admin SDK does
 * (https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library):
 *   alg RS256 · kid matches a current Google public key · aud = project id · iss = securetoken.google.com/<project>
 *   exp in the future · iat & auth_time in the past · sub (= Firebase uid) non-empty
 *
 * Needs only FIREBASE_PROJECT_ID in .env – no service-account file.
 */
import jwt from 'jsonwebtoken';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cache = { certs: null, expires: 0 };

export const firebaseProjectId = () => String(process.env.FIREBASE_PROJECT_ID || '').trim();
export const isFirebaseConfigured = () => Boolean(firebaseProjectId());

const getCerts = async (force = false) => {
  if (!force && cache.certs && Date.now() < cache.expires) return cache.certs;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Could not load Google public keys (HTTP ${res.status})`);
  const certs = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  cache = { certs, expires: Date.now() + Math.max(60, maxAge - 60) * 1000 };
  return certs;
};

const authError = (message) => Object.assign(new Error(message), { statusCode: 401 });

/** Returns the verified token payload: { uid, email, emailVerified, name, picture, phone, provider }. */
export const verifyFirebaseIdToken = async (idToken) => {
  const projectId = firebaseProjectId();
  if (!projectId) throw Object.assign(new Error('Google sign-in is not configured on the server (FIREBASE_PROJECT_ID missing).'), { statusCode: 503 });
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4096) throw authError('Missing Google sign-in token');

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header || decoded.header.alg !== 'RS256' || !decoded.header.kid) throw authError('Invalid Google sign-in token');

  let certs = await getCerts();
  // Google rotates keys – refresh once if the kid is new to us
  if (!certs[decoded.header.kid]) certs = await getCerts(true);
  const cert = certs[decoded.header.kid];
  if (!cert) throw authError('Google sign-in token was signed with an unknown key');

  let payload;
  try {
    payload = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      clockTolerance: 60,
    });
  } catch (err) {
    throw authError(err.name === 'TokenExpiredError' ? 'Google sign-in expired – please try again' : 'Invalid Google sign-in token');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) throw authError('Invalid Google sign-in token');
  if (payload.auth_time && payload.auth_time > now + 60) throw authError('Invalid Google sign-in token');

  return {
    uid: payload.sub,
    email: String(payload.email || '').toLowerCase().trim(),
    emailVerified: payload.email_verified === true,
    name: String(payload.name || '').trim(),
    picture: String(payload.picture || ''),
    phone: String(payload.phone_number || ''),
    provider: payload.firebase?.sign_in_provider || '',
  };
};
