require('dotenv').config();

const express = require('express');
const querystring = require('querystring');

const { verifySlackRequest } = require('./slackVerify');
const { nowPST, parseStandupInput } = require('./dateParser');
const { addItem } = require('./notionClient');
const { postFinal, successPayload, failurePayload } = require('./responder');

const app = express();

app.get('/', (_req, res) => res.status(200).send('ok'));

app.post(
  '/slack/standup',
  express.raw({ type: 'application/x-www-form-urlencoded' }),
  async (req, res) => {
    if (!verifySlackRequest(req.headers, req.body)) {
      return res.status(401).send('invalid signature');
    }

    const params = querystring.parse(req.body.toString('utf8'));
    const text = (params.text || '').toString();
    const responseUrl = (params.response_url || '').toString();
    const userName = (params.user_name || '').toString();

    const parsed = parseStandupInput(text, nowPST());

    if (parsed.error) {
      return res.status(200).json({ response_type: 'ephemeral', text: parsed.error });
    }

    const count = parsed.items.length;
    res.status(200).json({
      response_type: 'ephemeral',
      text: `Got it — adding ${count === 1 ? '1 item' : `${count} items`} to standup for ${parsed.targetDate}…`,
    });

    setImmediate(() =>
      handleAsync({
        dateString: parsed.targetDate,
        items: parsed.items,
        userName,
        responseUrl,
      })
    );
  }
);

async function handleAsync({ dateString, items, userName, responseUrl }) {
  try {
    const { pageUrl, created } = await addItem({ dateString, items, userName });
    await postFinal(responseUrl, successPayload({ dateString, items, pageUrl, created }));
  } catch (err) {
    console.error('Notion error:', err);
    const errorMessage = (err && err.message) ? err.message : 'unknown error';
    await postFinal(responseUrl, failurePayload({ errorMessage }));
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`standup server listening on ${PORT}`);
});
