const crypto = require('crypto');

const FIVE_MINUTES = 300;

function verifySlackRequest(headers, rawBodyBuffer) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = headers['x-slack-request-timestamp'];
  const receivedSig = headers['x-slack-signature'];
  if (!timestamp || !receivedSig) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > FIVE_MINUTES) return false;

  const base = `v0:${timestamp}:${rawBodyBuffer.toString('utf8')}`;
  const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(receivedSig);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { verifySlackRequest };
