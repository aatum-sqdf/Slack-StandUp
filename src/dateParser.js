const STANDUP_HOUR_PST = 19;

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function nowPST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'long',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const dateString = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour, 10) % 24;
  const weekday = WEEKDAYS[parts.weekday.toLowerCase()];
  return { date: dateString, hour, weekday };
}

function addDays(dateString, n) {
  const [y, m, d] = dateString.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(ms);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function isValidIsoDate(s) {
  if (!ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function resolveTarget(token, twoWord, pstNow) {
  const lower = token.toLowerCase();

  if (twoWord && twoWord.toLowerCase() === 'next standup') {
    return pstNow.hour < STANDUP_HOUR_PST ? pstNow.date : addDays(pstNow.date, 1);
  }

  if (lower === 'today') return pstNow.date;
  if (lower === 'tomorrow') return addDays(pstNow.date, 1);

  if (lower in WEEKDAYS) {
    const target = WEEKDAYS[lower];
    if (target === pstNow.weekday && pstNow.hour < STANDUP_HOUR_PST) {
      return pstNow.date;
    }
    let diff = (target - pstNow.weekday + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(pstNow.date, diff);
  }

  if (isValidIsoDate(token)) return token;

  return null;
}

function parseStandupInput(rawText, pstNow) {
  const text = (rawText || '').trim().replace(/\s+/g, ' ');
  if (!text) {
    return {
      error:
        'Please provide an item. Usage: `/standup [today|tomorrow|next standup|monday-sunday|YYYY-MM-DD] <item>`',
    };
  }

  const tokens = text.split(' ');

  if (tokens.length >= 2 && tokens[0].toLowerCase() === 'next' && tokens[1].toLowerCase() === 'standup') {
    const item = tokens.slice(2).join(' ').trim();
    if (!item) return { error: 'Provide an item after `next standup`.' };
    return { targetDate: resolveTarget(null, 'next standup', pstNow), item };
  }

  const firstResolved = resolveTarget(tokens[0], null, pstNow);
  if (firstResolved) {
    const item = tokens.slice(1).join(' ').trim();
    if (!item) return { error: `Provide an item after \`${tokens[0]}\`.` };
    return { targetDate: firstResolved, item };
  }

  return {
    targetDate: pstNow.hour < STANDUP_HOUR_PST ? pstNow.date : addDays(pstNow.date, 1),
    item: text,
  };
}

module.exports = { nowPST, parseStandupInput, addDays };
