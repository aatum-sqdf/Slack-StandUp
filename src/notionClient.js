const { Client } = require('@notionhq/client');

let _notion = null;
function notion() {
  if (!_notion) _notion = new Client({ auth: process.env.NOTION_TOKEN });
  return _notion;
}

async function findPageByDate(databaseId, dateString) {
  const res = await notion().databases.query({
    database_id: databaseId,
    filter: { property: 'Date', date: { equals: dateString } },
    page_size: 1,
  });
  return res.results[0] || null;
}

async function createDatePage(databaseId, dateString) {
  const baseProps = {
    Title: { title: [{ text: { content: dateString } }] },
    Date: { date: { start: dateString } },
  };

  try {
    return await notion().pages.create({
      parent: { database_id: databaseId },
      properties: { ...baseProps, Status: { status: { name: 'Open' } } },
    });
  } catch (err) {
    const msg = String(err && err.body || err && err.message || '');
    if (err && err.code === 'validation_error' && /Status/i.test(msg)) {
      return await notion().pages.create({
        parent: { database_id: databaseId },
        properties: baseProps,
      });
    }
    throw err;
  }
}

async function appendBullet(pageId, text) {
  await notion().blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: text } }],
        },
      },
    ],
  });
}

async function addItem({ dateString, itemText, userName }) {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error('NOTION_DATABASE_ID is not set');

  let page = await findPageByDate(databaseId, dateString);
  let created = false;
  if (!page) {
    page = await createDatePage(databaseId, dateString);
    created = true;
  }

  const bulletText = userName ? `@${userName}: ${itemText}` : itemText;
  await appendBullet(page.id, bulletText);

  return { pageUrl: page.url, created };
}

module.exports = { addItem };
