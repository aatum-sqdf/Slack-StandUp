const axios = require('axios');

async function postFinal(responseUrl, payload) {
  if (!responseUrl) return;
  try {
    await axios.post(
      responseUrl,
      {
        response_type: 'ephemeral',
        replace_original: false,
        ...payload,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
  } catch (err) {
    console.error('Failed to post to response_url:', err.message);
  }
}

function successPayload({ dateString, items, pageUrl, created }) {
  const lead = created ? 'Created standup for' : 'Added to standup for';
  const bullets = items.map(i => `• ${i}`).join('\n');
  return { text: `${lead} ${dateString}:\n${bullets}\n${pageUrl}` };
}

function failurePayload({ errorMessage }) {
  return { text: `Couldn't add to Notion: ${errorMessage}` };
}

module.exports = { postFinal, successPayload, failurePayload };
