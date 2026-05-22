const db = require('../config/db');
const { getRoleAccount, getProfileAccount } = require('../utils/helpers');
exports.adminTickets = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(404).render('error-404', { title: 'Admin Tidak Ditemukan' });
    const ticketsResult = await db.query(`
      SELECT
        t.ticket_id,
        t.ticket_code,
        tc.category_name,
        tc.price,
        e.event_id,
        e.event_title AS event_name,
        e.event_datetime,
        v.venue_name AS location,
        c.full_name AS customer_name,
        o.order_id,
        o.payment_status,
        o.order_date,
        CASE WHEN hr.seat_id IS NOT NULL THEN true ELSE false END AS has_seat,
        hr.seat_id,
        CASE WHEN hr.seat_id IS NOT NULL THEN s.section || ' ' || s.row_number || '-' || s.seat_number ELSE NULL END AS seat_label
      FROM ticket t
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      JOIN event e ON e.event_id = tc.tevent_id
      LEFT JOIN venue v ON v.venue_id = e.venue_id
      LEFT JOIN "ORDER" o ON o.order_id = t.torder_id
      LEFT JOIN customer c ON c.customer_id = o.customer_id
      LEFT JOIN has_relationship hr ON hr.ticket_id = t.ticket_id
      LEFT JOIN seat s ON s.seat_id = hr.seat_id
      ORDER BY o.order_date DESC NULLS LAST, t.ticket_code ASC
    `);
    const eventsResult = await db.query('SELECT event_id, event_title FROM event ORDER BY event_title');
    return res.render('manajemen_tiket', {
      title: 'Manajemen Tiket - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0],
        full_name: admin.display_name,
        username: admin.username
      },
      tickets: ticketsResult.rows,
      events: eventsResult.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerTickets = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) return res.status(404).render('error-404', { title: 'Organizer Tidak Ditemukan' });
    const ticketsResult = await db.query(`
      SELECT
        t.ticket_id,
        t.ticket_code,
        tc.category_name,
        tc.price,
        e.event_id,
        e.event_title AS event_name,
        e.event_datetime,
        v.venue_name AS location,
        c.full_name AS customer_name,
        o.order_id,
        o.payment_status,
        o.order_date,
        CASE WHEN hr.seat_id IS NOT NULL THEN true ELSE false END AS has_seat,
        hr.seat_id,
        CASE WHEN hr.seat_id IS NOT NULL THEN s.section || ' ' || s.row_number || '-' || s.seat_number ELSE NULL END AS seat_label
      FROM ticket t
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      JOIN event e ON e.event_id = tc.tevent_id
      LEFT JOIN venue v ON v.venue_id = e.venue_id
      LEFT JOIN "ORDER" o ON o.order_id = t.torder_id
      LEFT JOIN customer c ON c.customer_id = o.customer_id
      LEFT JOIN has_relationship hr ON hr.ticket_id = t.ticket_id
      LEFT JOIN seat s ON s.seat_id = hr.seat_id
      ORDER BY o.order_date DESC NULLS LAST, t.ticket_code ASC
    `);
    const eventsResult = await db.query('SELECT event_id, event_title FROM event ORDER BY event_title');
    return res.render('manajemen_tiket', {
      title: 'Manajemen Tiket - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0],
        full_name: organizer.display_name,
        username: organizer.username
      },
      tickets: ticketsResult.rows,
      events: eventsResult.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.deleteTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM has_relationship WHERE ticket_id = $1', [id]);
    const result = await db.query('DELETE FROM ticket WHERE ticket_id = $1 RETURNING ticket_code', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Tiket "' + result.rows[0].ticket_code + '" berhasil dihapus.' });
  } catch (err) {
    console.error('Delete ticket error:', err.message);
    let cleanMessage = err.message || 'Terjadi kesalahan saat menghapus tiket.';
    if (cleanMessage.includes('ERROR:')) {
      cleanMessage = cleanMessage.split('ERROR:').pop().trim();
    }
    return res.status(400).json({ success: false, message: cleanMessage });
  }
};
exports.updateTicket = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { seat_id, status } = req.body; 
    await client.query('BEGIN');
    const ticketCheck = await client.query(`
      SELECT t.ticket_id, t.ticket_code, tc.tevent_id, t.torder_id
      FROM ticket t
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      WHERE t.ticket_id = $1
    `, [id]);
    if (ticketCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    }
    const ticket = ticketCheck.rows[0];

    if (status) {
      let newPaymentStatus = 'Pending';
      if (status.toUpperCase() === 'VALID' || status.toUpperCase() === 'TERPAKAI') {
        newPaymentStatus = 'Paid';
      }
      await client.query('UPDATE "ORDER" SET payment_status = $1 WHERE order_id = $2', [newPaymentStatus, ticket.torder_id]);
    }

    await client.query('DELETE FROM has_relationship WHERE ticket_id = $1', [id]);
    if (seat_id) {
      const seatCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM has_relationship hr
          JOIN ticket t ON t.ticket_id = hr.ticket_id
          JOIN ticket_category tc ON tc.category_id = t.tcategory_id
          WHERE tc.tevent_id = $1 AND hr.seat_id = $2 AND hr.ticket_id != $3
        ) AS is_occupied
      `, [ticket.tevent_id, seat_id, id]);
      if (seatCheck.rows[0].is_occupied) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Kursi terpilih sudah ditempati oleh tiket lain.' });
      }
      await client.query(`
        INSERT INTO has_relationship (ticket_id, seat_id)
        VALUES ($1, $2)
      `, [id, seat_id]);
    }
    await client.query('COMMIT');
    return res.json({
      success: true,
      message: `Tiket "${ticket.ticket_code}" berhasil diperbarui!`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updateTicket:', err);
    let cleanMessage = err.message || 'Terjadi kesalahan saat memperbarui tiket.';
    if (cleanMessage.includes('ERROR:')) {
      cleanMessage = cleanMessage.split('ERROR:').pop().trim();
    }
    return res.status(400).json({ success: false, message: cleanMessage });
  } finally {
    client.release();
  }
};
exports.myTickets = async (req, res, next) => {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(404).render('error-404', { title: 'User Tidak Ditemukan' });
    }
    const account = await getProfileAccount(username);
    if (!account) {
      return res.status(404).render('error-404', { title: 'User Tidak Ditemukan' });
    }
    const roleList = String(account.roles || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
    const primaryRole = roleList.includes('ADMIN') ? 'ADMIN' : roleList.includes('ORGANIZER') ? 'ORGANIZER' : 'CUSTOMER';
    const roleAccount = await getRoleAccount(primaryRole, username);
    const user = {
      isAuthenticated: true,
      role: primaryRole,
      username: account.username,
      first_name: account.display_name.split(' ')[0] || account.display_name,
      full_name: account.display_name,
      id: primaryRole === 'CUSTOMER' ? roleAccount.customer_id : primaryRole === 'ORGANIZER' ? roleAccount.organizer_id : roleAccount.user_id
    };
    let query = `
      SELECT
        t.ticket_id,
        t.ticket_code,
        tc.category_name,
        tc.price,
        e.event_id,
        e.event_title AS event_name,
        e.event_datetime,
        v.venue_name AS location,
        c.full_name AS customer_name,
        o.order_id,
        o.payment_status,
        o.order_date,
        CASE WHEN hr.seat_id IS NOT NULL THEN true ELSE false END AS has_seat,
        hr.seat_id,
        CASE WHEN hr.seat_id IS NOT NULL THEN s.section || ' ' || s.row_number || '-' || s.seat_number ELSE NULL END AS seat_label
      FROM ticket t
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      JOIN event e ON e.event_id = tc.tevent_id
      LEFT JOIN venue v ON v.venue_id = e.venue_id
      LEFT JOIN "ORDER" o ON o.order_id = t.torder_id
      LEFT JOIN customer c ON c.customer_id = o.customer_id
      LEFT JOIN has_relationship hr ON hr.ticket_id = t.ticket_id
      LEFT JOIN seat s ON s.seat_id = hr.seat_id
    `;
    const params = [];
    if (primaryRole === 'CUSTOMER') {
      query += ` WHERE o.customer_id = $1 `;
      params.push(user.id);
    } else if (primaryRole === 'ORGANIZER') {
      query += ` WHERE e.organizer_id = $1 `;
      params.push(user.id);
    }
    query += ` ORDER BY o.order_date DESC NULLS LAST, t.ticket_code ASC `;
    const ticketsResult = await db.query(query, params);
    const tickets = ticketsResult.rows;
    const totalCount = tickets.length;
    const validCount = tickets.filter(t => t.payment_status === 'Paid' || t.payment_status === 'Lunas').length;
    const usedCount = tickets.filter(t => t.has_seat).length;
    return res.render('my_tickets', {
      title: primaryRole === 'CUSTOMER' ? 'Tiket Saya' : 'Manajemen Tiket',
      ticketRole: primaryRole.toLowerCase(),
      user,
      tickets,
      ticketCount: totalCount,
      upcomingCount: validCount,
      completedCount: usedCount
    });
  } catch (err) {
    return next(err);
  }
};
exports.seats = (req, res) => {
  res.render('seats', {
    title: 'Pilih Kursi',
    user: { first_name: 'Budi' },
    event: {
      id: 1,
      name: 'Konser Melodi Senja',
      date: '2024-05-15',
      venue: 'Jakarta Convention Center'
    },
    seatingChart: {
      rows: 10,
      seatsPerRow: 15,
      occupiedSeats: [5, 10, 15, 25, 30, 50],
      selectedSeats: []
    },
    ticketPrice: 750000
  });
};
exports.getOrdersForTicket = async (req, res, next) => {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    const account = await getProfileAccount(username);
    if (!account) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const roleList = String(account.roles || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
    const primaryRole = roleList.includes('ADMIN') ? 'ADMIN' : roleList.includes('ORGANIZER') ? 'ORGANIZER' : 'CUSTOMER';
    const roleAccount = await getRoleAccount(primaryRole, username);
    const userId = primaryRole === 'CUSTOMER' ? roleAccount.customer_id : primaryRole === 'ORGANIZER' ? roleAccount.organizer_id : roleAccount.user_id;
    let query = `
      SELECT DISTINCT 
        o.order_id, 
        c.full_name AS customer_name, 
        e.event_title AS event_name, 
        e.event_id
      FROM "ORDER" o
      JOIN customer c ON o.customer_id = c.customer_id
      JOIN ticket t ON t.torder_id = o.order_id
      JOIN ticket_category tc ON tc.category_id = t.tcategory_id
      JOIN event e ON e.event_id = tc.tevent_id
    `;
    const params = [];
    if (primaryRole === 'ORGANIZER') {
      query += ` WHERE e.organizer_id = $1 `;
      params.push(userId);
    } else if (primaryRole === 'CUSTOMER') {
      query += ` WHERE o.customer_id = $1 `;
      params.push(userId);
    }
    query += ` ORDER BY o.order_id `;
    const result = await db.query(query, params);
    return res.json({ success: true, orders: result.rows });
  } catch (err) {
    console.error('Error getOrdersForTicket:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
exports.getEventTicketDetails = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const venueCheck = await db.query(`
      SELECT 
        v.venue_id,
        CASE WHEN COUNT(s.seat_id) > 0 THEN true ELSE false END AS has_seats
      FROM event e
      JOIN venue v ON v.venue_id = e.venue_id
      LEFT JOIN seat s ON s.venue_id = v.venue_id
      WHERE e.event_id = $1
      GROUP BY v.venue_id
    `, [eventId]);
    if (venueCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Event tidak ditemukan.' });
    }
    const hasSeats = venueCheck.rows[0].has_seats;
    const categoriesResult = await db.query(`
      SELECT 
        tc.category_id, 
        tc.category_name, 
        tc.price, 
        tc.quota,
        COALESCE(rq.sisa_kuota, tc.quota) AS sisa_kuota
      FROM ticket_category tc
      LEFT JOIN get_remaining_quota_by_event($1) rq ON rq.category_id = tc.category_id
      WHERE tc.tevent_id = $1
      ORDER BY tc.category_name
    `, [eventId]);
    let seats = [];
    if (hasSeats) {
      const seatsResult = await db.query(`
        SELECT s.seat_id, s.section, s.row_number, s.seat_number
        FROM seat s
        JOIN event e ON e.venue_id = s.venue_id
        WHERE e.event_id = $1
          AND s.seat_id NOT IN (
            SELECT hr.seat_id 
            FROM has_relationship hr
            JOIN ticket t ON t.ticket_id = hr.ticket_id
            JOIN ticket_category tc ON tc.category_id = t.tcategory_id
            WHERE tc.tevent_id = $1
          )
        ORDER BY s.section, s.row_number, s.seat_number
      `, [eventId]);
      seats = seatsResult.rows;
    }
    return res.json({
      success: true,
      has_seats: hasSeats,
      categories: categoriesResult.rows,
      seats: seats
    });
  } catch (err) {
    console.error('Error getEventTicketDetails:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
exports.createTicket = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { torder_id, tcategory_id, seat_id } = req.body;
    if (!torder_id || !tcategory_id) {
      return res.status(400).json({ success: false, message: 'Order dan Kategori Tiket wajib diisi.' });
    }
    await client.query('BEGIN');
    const eventCheck = await client.query(`
      SELECT tc.tevent_id, tc.quota, tc.category_name, e.event_title,
             COALESCE(rq.sisa_kuota, tc.quota) AS sisa_kuota
      FROM ticket_category tc
      JOIN event e ON e.event_id = tc.tevent_id
      LEFT JOIN get_remaining_quota_by_event(tc.tevent_id) rq ON rq.category_id = tc.category_id
      WHERE tc.category_id = $1
    `, [tcategory_id]);
    if (eventCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Kategori tiket tidak ditemukan.' });
    }
    const { tevent_id, quota, category_name, event_title, sisa_kuota } = eventCheck.rows[0];
    if (seat_id) {
      const seatCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM has_relationship hr
          JOIN ticket t ON t.ticket_id = hr.ticket_id
          JOIN ticket_category tc ON tc.category_id = t.tcategory_id
          WHERE tc.tevent_id = $1 AND hr.seat_id = $2
        ) AS is_occupied
      `, [tevent_id, seat_id]);
      if (seatCheck.rows[0].is_occupied) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Kursi terpilih sudah ditempati oleh tiket lain.' });
      }
    }
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tCode = `TKT-${event_title.substring(0, 3).toUpperCase()}-${category_name.substring(0, 3).toUpperCase()}-${randomSuffix}`;
    const ticketInsert = await client.query(`
      INSERT INTO ticket (ticket_id, ticket_code, tcategory_id, torder_id)
      VALUES (gen_random_uuid(), $1, $2, $3)
      RETURNING ticket_id, ticket_code
    `, [tCode, tcategory_id, torder_id]);
    const newTicketId = ticketInsert.rows[0].ticket_id;
    const finalTicketCode = ticketInsert.rows[0].ticket_code;
    if (seat_id) {
      await client.query(`
        INSERT INTO has_relationship (ticket_id, seat_id)
        VALUES ($1, $2)
      `, [newTicketId, seat_id]);
    }
    await client.query('COMMIT');
    return res.json({
      success: true,
      message: `Tiket "${finalTicketCode}" berhasil dibuat!`,
      ticket_code: finalTicketCode
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error createTicket:', err);
    let cleanMessage = err.message || 'Terjadi kesalahan sistem saat membuat tiket.';
    if (cleanMessage.includes('ERROR:')) {
      const idx = cleanMessage.indexOf('ERROR:');
      cleanMessage = cleanMessage.substring(idx);
    }
    return res.status(400).json({ success: false, message: cleanMessage });
  } finally {
    client.release();
  }
};
