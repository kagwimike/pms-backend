const { Op } = require('sequelize');

const encodeCursor = (id) => {
  if (!id) return null;
  return Buffer.from(id.toString()).toString('base64');
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  const decoded = Buffer.from(cursor, 'base64').toString('ascii');
  return parseInt(decoded, 10);
};

const getCursorPagination = (cursorStr, size) => {
  const limit = size ? Math.min(parseInt(size), 100) : 10;
  const cursorId = decodeCursor(cursorStr);
  
  // Assuming default sort is newest first (id DESC)
  // To get older items, we fetch IDs LESS THAN the cursor
  const where = cursorId ? { id: { [Op.lt]: cursorId } } : {};
  const order = [['id', 'DESC']];

  return { limit, where, order };
};

const getCursorPagingData = (rows, limit) => {
  let nextCursor = null;
  
  // If we fetched exactly 'limit' items, there might be more. 
  // Set nextCursor to the ID of the last item.
  if (rows.length > 0 && rows.length === limit) {
    const lastItem = rows[rows.length - 1];
    nextCursor = encodeCursor(lastItem.id);
  }

  return {
    rows,
    meta: {
      limit,
      nextCursor
    }
  };
};

module.exports = {
  encodeCursor,
  decodeCursor,
  getCursorPagination,
  getCursorPagingData
};
