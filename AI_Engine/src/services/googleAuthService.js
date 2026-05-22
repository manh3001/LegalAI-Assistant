const { OAuth2Client } = require('google-auth-library');

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (!googleClientId) {
  throw new Error('Missing GOOGLE_CLIENT_ID in environment configuration');
}

const client = new OAuth2Client(googleClientId);

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Unable to parse Google ID token payload');
  }

  return payload;
}

module.exports = {
  verifyGoogleIdToken
};
