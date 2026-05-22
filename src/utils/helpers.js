const db = require('../config/db');
function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}
function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date);
}
async function getRoleAccount(roleName, username = null) {
  const params = [roleName];
  const usernameFilter = username ? 'AND LOWER(ua.username) = LOWER($2)' : '';
  if (username) {
    params.push(username);
  }
  const result = await db.query(
    `
      SELECT
        ua.user_id,
        ua.username,
        o.organizer_id,
        c.customer_id,
        COALESCE(c.full_name, o.organizer_name, ua.username) AS display_name,
        COALESCE(c.email, o.contact_email, '') AS email
      FROM user_account ua
      JOIN account_role ar ON ar.user_id = ua.user_id
      JOIN role r ON r.role_id = ar.role_id
      LEFT JOIN customer c ON c.user_id = ua.user_id
      LEFT JOIN organizer o ON o.user_id = ua.user_id
      WHERE UPPER(r.role_name) = UPPER($1)
      ${usernameFilter}
      ORDER BY ua.username
      LIMIT 1
    `,
    params
  );
  return result.rows[0] || null;
}
async function getProfileAccount(username) {
  if (!username) {
    return null;
  }
  const result = await db.query(
    `
      SELECT
        ua.user_id,
        ua.username,
        COALESCE(c.full_name, o.organizer_name, ua.username) AS display_name,
        COALESCE(c.email, o.contact_email, '') AS email,
        COALESCE(c.phone_number, '') AS phone_number,
        COALESCE(c.full_name, '') AS customer_full_name,
        COALESCE(o.organizer_name, '') AS organizer_name,
        COALESCE(o.contact_email, '') AS organizer_email,
        COALESCE(
          STRING_AGG(UPPER(r.role_name), ',' ORDER BY
            CASE UPPER(r.role_name)
              WHEN 'ADMIN' THEN 1
              WHEN 'ORGANIZER' THEN 2
              WHEN 'CUSTOMER' THEN 3
              ELSE 4
            END
          ),
          ''
        ) AS roles
      FROM user_account ua
      LEFT JOIN account_role ar ON ar.user_id = ua.user_id
      LEFT JOIN role r ON r.role_id = ar.role_id
      LEFT JOIN customer c ON c.user_id = ua.user_id
      LEFT JOIN organizer o ON o.user_id = ua.user_id
      WHERE LOWER(ua.username) = LOWER($1)
      GROUP BY
        ua.user_id,
        ua.username,
        c.full_name,
        c.email,
        c.phone_number,
        o.organizer_name,
        o.contact_email
      LIMIT 1
    `,
    [username]
  );
  return result.rows[0] || null;
}
async function getCustomerDashboardData(customerId) {
  const summaryResult = await db.query(
    `
      SELECT
        COUNT(DISTINCT t.ticket_id)::int AS ticket_count,
        COUNT(DISTINCT e.event_id)::int AS event_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM promotion p
          WHERE CURRENT_DATE BETWEEN p.start_date AND p.end_date
        ), 0) AS promo_count,
        COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS total_spent
      FROM customer c
      LEFT JOIN "ORDER" o ON o.customer_id = c.customer_id
      LEFT JOIN ticket t ON t.torder_id = o.order_id
      LEFT JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      LEFT JOIN event e ON e.event_id = tc.tevent_id
      WHERE c.customer_id = $1
      GROUP BY c.customer_id
    `,
    [customerId]
  );
  const upcomingTicketsResult = await db.query(
    `
      SELECT
        t.ticket_id AS id,
        e.event_title AS event_name,
        e.event_datetime AS event_date,
        v.venue_name AS venue,
        tc.category_name AS tier
      FROM customer c
      JOIN "ORDER" o ON o.customer_id = c.customer_id
      JOIN ticket t ON t.torder_id = o.order_id
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      JOIN event e ON e.event_id = tc.tevent_id
      JOIN venue v ON v.venue_id = e.venue_id
      WHERE c.customer_id = $1
      ORDER BY e.event_datetime ASC, o.order_date DESC
      LIMIT 5
    `,
    [customerId]
  );
  const summary = summaryResult.rows[0] || {
    ticket_count: 0,
    event_count: 0,
    promo_count: 0,
    total_spent: 0
  };
  return {
    ticketCount: Number(summary.ticket_count) || 0,
    eventCount: Number(summary.event_count) || 0,
    promoCount: Number(summary.promo_count) || 0,
    totalSpent: formatCurrency(summary.total_spent),
    upcomingTickets: upcomingTicketsResult.rows.map((row) => ({
      id: row.id,
      event_name: row.event_name,
      date: formatDate(row.event_date),
      venue: row.venue,
      tier: row.tier
    }))
  };
}
async function getAdminDashboardData() {
  const [summaryResult, recentOrdersResult] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM user_account) AS total_users,
        (SELECT COUNT(*)::int FROM event) AS total_events,
        COALESCE((SELECT SUM(total_amount) FROM "ORDER" WHERE UPPER(payment_status) = 'PAID'), 0)::numeric(12,2) AS total_revenue,
        (SELECT COUNT(*)::int FROM promotion WHERE CURRENT_DATE BETWEEN start_date AND end_date) AS active_promos
    `),
    db.query(
      `
        SELECT
          o.order_id AS id,
          c.full_name AS buyer_name,
          c.email AS buyer_email,
          COALESCE(STRING_AGG(DISTINCT e.event_title, ', '), 'Unknown Event') AS event_name,
          COUNT(t.ticket_id)::int AS quantity,
          o.total_amount::numeric(12,2) AS total,
          o.payment_status AS status,
          o.order_date AS date
        FROM "ORDER" o
        JOIN customer c ON c.customer_id = o.customer_id
        LEFT JOIN ticket t ON t.torder_id = o.order_id
        LEFT JOIN ticket_category tc ON tc.category_id = t.tcategory_id
        LEFT JOIN event e ON e.event_id = tc.tevent_id
        GROUP BY o.order_id, c.full_name, c.email, o.total_amount, o.payment_status, o.order_date
        ORDER BY o.order_date DESC
        LIMIT 5
      `
    )
  ]);
  const summary = summaryResult.rows[0] || {};
  return {
    totalUsers: Number(summary.total_users) || 0,
    totalEvents: Number(summary.total_events) || 0,
    totalRevenue: formatCurrency(summary.total_revenue),
    activePromos: Number(summary.active_promos) || 0,
    recentOrders: recentOrdersResult.rows.map((row) => ({
      id: row.id,
      buyer_name: row.buyer_name,
      buyer_email: row.buyer_email,
      event_name: row.event_name,
      quantity: Number(row.quantity) || 0,
      total: formatCurrency(row.total),
      status: row.status,
      date: formatDate(row.date)
    }))
  };
}
async function getOrganizerDashboardData(organizerId, organizerDisplayName) {
  const [summaryResult, upcomingEventsResult, organizerRevenueResult, attendeeResult] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS event_count FROM event WHERE organizer_id = $1`,
      [organizerId]
    ),
    db.query(
      `
        SELECT
          e.event_id AS id,
          e.event_title AS name,
          e.event_datetime AS date,
          v.venue_name AS venue,
          COUNT(t.ticket_id)::int AS tickets_sold,
          CASE WHEN e.event_datetime >= NOW() THEN 'active' ELSE 'past' END AS status
        FROM event e
        JOIN venue v ON v.venue_id = e.venue_id
        LEFT JOIN ticket_category tc ON tc.tevent_id = e.event_id
        LEFT JOIN ticket t ON t.tcategory_id = tc.category_id
        WHERE e.organizer_id = $1
        GROUP BY e.event_id, e.event_title, e.event_datetime, v.venue_name
        ORDER BY e.event_datetime ASC
      `,
      [organizerId]
    ),
    db.query(
      `
        SELECT COALESCE(SUM(o.total_amount), 0)::numeric(12,2) AS revenue
        FROM "ORDER" o
        WHERE EXISTS (
          SELECT 1
          FROM ticket t
          JOIN ticket_category tc ON tc.category_id = t.tcategory_id
          JOIN event e ON e.event_id = tc.tevent_id
          WHERE t.torder_id = o.order_id
            AND e.organizer_id = $1
        )
      `,
      [organizerId]
    ),
    db.query(
      `
        SELECT COUNT(DISTINCT o.customer_id)::int AS attendees
        FROM "ORDER" o
        WHERE EXISTS (
          SELECT 1
          FROM ticket t
          JOIN ticket_category tc ON tc.category_id = t.tcategory_id
          JOIN event e ON e.event_id = tc.tevent_id
          WHERE t.torder_id = o.order_id
            AND e.organizer_id = $1
        )
      `,
      [organizerId]
    )
  ]);
  const summary = summaryResult.rows[0] || { event_count: 0 };
  return {
    organizerName: organizerDisplayName || 'Organizer',
    eventCount: Number(summary.event_count) || 0,
    revenue: formatCurrency(organizerRevenueResult.rows[0]?.revenue),
    ticketsSold: upcomingEventsResult.rows.reduce((total, row) => total + (Number(row.tickets_sold) || 0), 0),
    attendees: Number(attendeeResult.rows[0]?.attendees) || 0,
    upcomingEvents: upcomingEventsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      date: formatDate(row.date),
      venue: row.venue,
      tickets_sold: Number(row.tickets_sold) || 0,
      status: row.status
    }))
  };
}
async function getVenuePageData() {
  const [venuesResult, statsResult] = await Promise.all([
    db.query(`
      SELECT
        v.venue_id AS id,
        v.venue_name AS name,
        v.capacity,
        v.address,
        v.city,
        CASE WHEN COUNT(s.seat_id) > 0 THEN true ELSE false END AS has_seats
      FROM venue v
      LEFT JOIN seat s ON s.venue_id = v.venue_id
      GROUP BY v.venue_id, v.venue_name, v.capacity, v.address, v.city
      ORDER BY v.venue_name ASC
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total_venues,
        COALESCE(SUM(capacity), 0)::int AS total_capacity,
        (SELECT COUNT(DISTINCT v2.venue_id)::int FROM venue v2 INNER JOIN seat s2 ON s2.venue_id = v2.venue_id) AS reserved_count
      FROM venue
    `)
  ]);
  const stats = statsResult.rows[0] || { total_venues: 0, total_capacity: 0, reserved_count: 0 };
  const freeCount = stats.total_venues - (stats.reserved_count || 0);
  return {
    venues: venuesResult.rows,
    totalVenues: stats.total_venues,
    reservedCount: stats.reserved_count || 0,
    freeCount: freeCount,
    totalCapacity: new Intl.NumberFormat('id-ID').format(stats.total_capacity)
  };
}
async function getEventPageData(organizerId = null) {
  let eventQuery = `
      SELECT e.event_id, e.event_title, e.event_datetime, e.venue_id,
             v.venue_name, o.organizer_name, o.organizer_id,
             STRING_AGG(DISTINCT a.name, ', ') AS artists,
             STRING_AGG(DISTINCT a.artist_id::text, ',') AS artist_ids,
             STRING_AGG(DISTINCT tc.category_name, ', ') AS categories
      FROM event e
      JOIN venue v ON v.venue_id = e.venue_id
      JOIN organizer o ON o.organizer_id = e.organizer_id
      LEFT JOIN event_artist ea ON ea.event_id = e.event_id
      LEFT JOIN artist a ON a.artist_id = ea.artist_id
      LEFT JOIN ticket_category tc ON tc.tevent_id = e.event_id
  `;
  const queryParams = [];
  let statsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM event) AS total_events,
        (SELECT COUNT(*)::int FROM event WHERE event_datetime > NOW()) AS upcoming_count,
        (SELECT COUNT(DISTINCT a2.artist_id)::int FROM event_artist a2) AS total_artists,
        (SELECT COUNT(*)::int FROM ticket_category) AS total_categories
  `;
  if (organizerId) {
    eventQuery += ` WHERE e.organizer_id = $1 `;
    queryParams.push(organizerId);
    statsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM event WHERE organizer_id = $1) AS total_events,
        (SELECT COUNT(*)::int FROM event WHERE organizer_id = $1 AND event_datetime > NOW()) AS upcoming_count,
        (SELECT COUNT(DISTINCT ea.artist_id)::int FROM event_artist ea JOIN event e ON e.event_id = ea.event_id WHERE e.organizer_id = $1) AS total_artists,
        (SELECT COUNT(DISTINCT tc.category_id)::int FROM ticket_category tc JOIN event e ON e.event_id = tc.tevent_id WHERE e.organizer_id = $1) AS total_categories
    `;
  }
  eventQuery += `
      GROUP BY e.event_id, e.event_title, e.event_datetime, e.venue_id,
               v.venue_name, o.organizer_name, o.organizer_id
      ORDER BY e.event_datetime DESC
  `;
  const [eventsResult, venuesResult, statsResult, artistsResult] = await Promise.all([
    db.query(eventQuery, queryParams),
    db.query('SELECT venue_id, venue_name FROM venue ORDER BY venue_name'),
    db.query(statsQuery, organizerId ? [organizerId] : []),
    db.query('SELECT artist_id, name, genre FROM artist ORDER BY name ASC')
  ]);
  const tcResult = await db.query('SELECT category_id, category_name, quota, price, tevent_id FROM ticket_category ORDER BY category_name');
  const tcMap = {};
  tcResult.rows.forEach(tc => {
    if (!tcMap[tc.tevent_id]) tcMap[tc.tevent_id] = [];
    tcMap[tc.tevent_id].push(tc);
  });
  const events = eventsResult.rows.map(e => ({
    ...e,
    ticket_categories: tcMap[e.event_id] || []
  }));
  const stats = statsResult.rows[0] || {};
  return {
    events,
    venues: venuesResult.rows,
    artistList: artistsResult.rows,
    totalEvents: stats.total_events || 0,
    upcomingCount: stats.upcoming_count || 0,
    totalArtists: stats.total_artists || 0,
    totalCategories: stats.total_categories || 0
  };
}
module.exports = {
  formatCurrency,
  formatDate,
  getRoleAccount,
  getProfileAccount,
  getCustomerDashboardData,
  getAdminDashboardData,
  getOrganizerDashboardData,
  getVenuePageData,
  getEventPageData
};
