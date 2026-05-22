const db = require('../config/db');
const { getRoleAccount, getProfileAccount } = require('../utils/helpers');
exports.listOrders = async (req, res, next) => {
  try {
    const username = req.query.username;
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
    let query = '';
    let params = [];
    if (primaryRole === 'ADMIN') {
      query = `
        SELECT o.order_id, c.full_name as customer_name, o.order_date, o.payment_status, o.total_amount 
        FROM "ORDER" o 
        JOIN customer c ON o.customer_id = c.customer_id 
        ORDER BY o.order_date DESC
      `;
    } else if (primaryRole === 'ORGANIZER') {
      query = `
        SELECT DISTINCT o.order_id, c.full_name as customer_name, o.order_date, o.payment_status, o.total_amount 
        FROM "ORDER" o 
        JOIN customer c ON o.customer_id = c.customer_id 
        JOIN ticket t ON t.torder_id = o.order_id 
        JOIN ticket_category tc ON tc.category_id = t.tcategory_id 
        JOIN event e ON e.event_id = tc.tevent_id 
        WHERE e.organizer_id = $1 
        ORDER BY o.order_date DESC
      `;
      params = [user.id];
    } else { 
      query = `
        SELECT o.order_id, c.full_name as customer_name, o.order_date, o.payment_status, o.total_amount 
        FROM "ORDER" o 
        JOIN customer c ON o.customer_id = c.customer_id 
        WHERE o.customer_id = $1 
        ORDER BY o.order_date DESC
      `;
      params = [user.id];
    }
    const result = await db.query(query, params);
    const orders = result.rows;
    const summary = {
      total: orders.length,
      lunas: orders.filter(o => o.payment_status.toLowerCase() === 'paid' || o.payment_status.toLowerCase() === 'lunas').length,
      pending: orders.filter(o => o.payment_status.toLowerCase() === 'pending').length,
      revenue: orders.reduce((acc, o) => acc + (o.payment_status.toLowerCase() === 'paid' || o.payment_status.toLowerCase() === 'lunas' ? Number(o.total_amount) : 0), 0)
    };
    res.render('order_list', { orders, summary, user, path: '/orders' });
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    return next(err);
  }
};
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;
    await db.query('UPDATE "ORDER" SET payment_status = $1 WHERE order_id = $2', [payment_status, id]);
    res.json({ success: true, message: 'Status pembayaran berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.deleteOrder = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    await client.query(`
      DELETE FROM has_relationship 
      WHERE ticket_id IN (SELECT ticket_id FROM ticket WHERE torder_id = $1)
    `, [id]);
    await client.query('DELETE FROM order_promotion WHERE order_id = $1', [id]);
    await client.query('DELETE FROM ticket WHERE torder_id = $1', [id]);
    const result = await client.query('DELETE FROM "ORDER" WHERE order_id = $1 RETURNING order_id', [id]);
    if (result.rowCount === 0) {
      throw new Error('Order tidak ditemukan');
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Data order berhasil dihapus beserta seluruh relasinya.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
exports.checkout = async (req, res, next) => {
  try {
    const username = req.query.username;
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
    const eventId = req.params.eventId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    if (!isUuid) {
      return res.status(404).send(`ERROR: Event dengan ID ${eventId} tidak ditemukan.`);
    }
    const eventQuery = await db.query(`
      SELECT e.event_id, e.event_title, e.event_datetime, e.venue_id, v.venue_name, 
             string_agg(a.name, ', ') as artists
      FROM event e
      LEFT JOIN venue v ON e.venue_id = v.venue_id
      LEFT JOIN event_artist ea ON ea.event_id = e.event_id
      LEFT JOIN artist a ON a.artist_id = ea.artist_id
      WHERE e.event_id = $1
      GROUP BY e.event_id, v.venue_name
    `, [eventId]);
    if (eventQuery.rows.length === 0) {
      return res.status(404).send(`ERROR: Event dengan ID ${eventId} tidak ditemukan.`);
    }
    const eventData = eventQuery.rows[0];
    const catQuery = await db.query(`
      SELECT tc.category_id, tc.category_name, tc.price, tc.quota,
             (SELECT sisa_kuota FROM get_remaining_quota_by_event(tc.tevent_id) rq WHERE rq.category_id = tc.category_id) as sisa
      FROM ticket_category tc
      WHERE tc.tevent_id = $1
      ORDER BY tc.price DESC
    `, [eventId]);
    const seatQuery = await db.query(`
      SELECT s.seat_id, s.section, s.row_number, s.seat_number,
             CASE WHEN EXISTS (
               SELECT 1 
               FROM has_relationship hr
               JOIN ticket t ON t.ticket_id = hr.ticket_id
               JOIN ticket_category tc ON tc.category_id = t.tcategory_id
               WHERE tc.tevent_id = $1 AND hr.seat_id = s.seat_id
             ) THEN true ELSE false END AS is_occupied
      FROM seat s
      WHERE s.venue_id = $2
      ORDER BY s.section, s.row_number, s.seat_number
    `, [eventId, eventData.venue_id]);
    res.render('checkout', { event: eventData, categories: catQuery.rows, seats: seatQuery.rows, user, path: '/checkout' });
  } catch (err) {
    console.error('Checkout error:', err.message);
    return next(err);
  }
};
exports.validatePromo = async (req, res) => {
  try {
    const { code } = req.body;
    const promo = await db.query('SELECT * FROM promotion WHERE promo_code = $1', [code.toUpperCase()]);
    if (promo.rows.length > 0) {
      const today = new Date();
      const startDate = new Date(promo.rows[0].start_date);
      const endDate = new Date(promo.rows[0].end_date);
      if (today >= startDate && today <= endDate) {
        res.json({ success: true, promo: promo.rows[0] });
      } else {
        res.json({ success: false, message: 'Kode promo sudah kedaluwarsa atau belum aktif.' });
      }
    } else {
      res.json({ success: false, message: 'Kode promo tidak valid.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.processCheckout = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { category_id, quantity, promo_code, total_amount, customer_id, selected_seats } = req.body;
    const qty = parseInt(quantity, 10);
    const userId = customer_id || '44444444-4444-4444-4444-444444444444';
    const orderRes = await client.query(`
      INSERT INTO "ORDER" (order_id, order_date, payment_status, total_amount, customer_id)
      VALUES (gen_random_uuid(), NOW(), 'Pending', $1, $2)
      RETURNING order_id
    `, [total_amount, userId]);
    const orderId = orderRes.rows[0].order_id;
    for (let i = 0; i < qty; i++) {
      const tCode = 'TKT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const tRes = await client.query(`
        INSERT INTO ticket (ticket_id, ticket_code, tcategory_id, torder_id)
        VALUES (gen_random_uuid(), $1, $2, $3)
        RETURNING ticket_id
      `, [tCode, category_id, orderId]);
      const ticketId = tRes.rows[0].ticket_id;
      if (selected_seats && selected_seats[i]) {
        await client.query(`
          INSERT INTO has_relationship (ticket_id, seat_id)
          VALUES ($1, $2)
        `, [ticketId, selected_seats[i]]);
      }
    }
    if (promo_code) {
      const p = await client.query('SELECT promotion_id FROM promotion WHERE promo_code = $1', [promo_code.toUpperCase()]);
      if (p.rows.length > 0) {
        await client.query(`
          INSERT INTO order_promotion (order_promotion_id, promotion_id, order_id)
          VALUES (gen_random_uuid(), $1, $2)
        `, [p.rows[0].promotion_id, orderId]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
exports.adminOrders = (req, res) => {
  const username = req.query.username || 'admin';
  res.redirect(`/orders?username=${encodeURIComponent(username)}`);
};
exports.listPromotions = async (req, res, next) => {
  try {
    const username = req.query.username;
    let user = null;
    if (username) {
      const account = await getProfileAccount(username);
      if (account) {
        const roleList = String(account.roles || '').split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
        const primaryRole = roleList.includes('ADMIN') ? 'ADMIN' : roleList.includes('ORGANIZER') ? 'ORGANIZER' : 'CUSTOMER';
        const roleAccount = await getRoleAccount(primaryRole, username);
        user = {
          isAuthenticated: true,
          role: primaryRole,
          username: account.username,
          first_name: account.display_name.split(' ')[0] || account.display_name,
          full_name: account.display_name,
          id: primaryRole === 'CUSTOMER' ? roleAccount.customer_id : primaryRole === 'ORGANIZER' ? roleAccount.organizer_id : roleAccount.user_id
        };
      }
    }
    const statsTotalRes = await db.query('SELECT COUNT(*)::int AS count FROM promotion');
    const statsUsageRes = await db.query('SELECT COUNT(*)::int AS count FROM order_promotion');
    const statsPctRes = await db.query("SELECT COUNT(*)::int AS count FROM promotion WHERE UPPER(discount_type) = 'PERCENTAGE'");
    const stats = {
      totalPromo: statsTotalRes.rows[0].count || 0,
      totalUsage: statsUsageRes.rows[0].count || 0,
      totalPercentage: statsPctRes.rows[0].count || 0
    };
    const promoRes = await db.query(`
      SELECT 
        p.promotion_id,
        p.promo_code,
        p.discount_type,
        p.discount_value,
        p.start_date,
        p.end_date,
        p.usage_limit,
        COALESCE(COUNT(op.order_promotion_id), 0)::int AS usage_count
      FROM promotion p
      LEFT JOIN order_promotion op ON p.promotion_id = op.promotion_id
      GROUP BY p.promotion_id, p.promo_code, p.discount_type, p.discount_value, p.start_date, p.end_date, p.usage_limit
      ORDER BY p.promo_code ASC
    `);
    res.render('promotion_list', {
      title: 'Manajemen Promosi - TikTakTuk',
      user,
      stats,
      promotions: promoRes.rows
    });
  } catch (err) {
    next(err);
  }
};
exports.createPromotion = async (req, res) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Admin yang dapat menambah promosi.' });
    const { promo_code, discount_type, discount_value, start_date, end_date, usage_limit } = req.body;
    if (!promo_code || !promo_code.trim()) {
      return res.status(400).json({ success: false, message: 'Kode promo wajib diisi.' });
    }
    if (!discount_type || !['PERCENTAGE', 'NOMINAL'].includes(discount_type.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Tipe diskon tidak valid.' });
    }
    const val = parseFloat(discount_value);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Nilai diskon wajib bernilai positif.' });
    }
    if (discount_type.toUpperCase() === 'PERCENTAGE' && val > 100) {
      return res.status(400).json({ success: false, message: 'Nilai diskon persentase tidak boleh melebihi 100%.' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Tanggal mulai dan berakhir wajib diisi.' });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'Tanggal berakhir harus lebih besar atau sama dengan tanggal mulai.' });
    }
    const limit = parseInt(usage_limit, 10);
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ success: false, message: 'Batas penggunaan wajib bernilai positif.' });
    }
    const checkDup = await db.query('SELECT 1 FROM promotion WHERE LOWER(promo_code) = LOWER($1)', [promo_code.trim()]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Kode promo "' + promo_code.trim().toUpperCase() + '" sudah digunakan.' });
    }
    await db.query(`
      INSERT INTO promotion (promotion_id, promo_code, discount_type, discount_value, start_date, end_date, usage_limit)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
    `, [promo_code.trim().toUpperCase(), discount_type.toUpperCase(), val, start_date, end_date, limit]);
    res.json({ success: true, message: 'Promosi berhasil ditambahkan.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
exports.updatePromotion = async (req, res) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Admin yang dapat mengubah promosi.' });
    const { id } = req.params;
    const { promo_code, discount_type, discount_value, start_date, end_date, usage_limit } = req.body;
    if (!promo_code || !promo_code.trim()) {
      return res.status(400).json({ success: false, message: 'Kode promo wajib diisi.' });
    }
    if (!discount_type || !['PERCENTAGE', 'NOMINAL'].includes(discount_type.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Tipe diskon tidak valid.' });
    }
    const val = parseFloat(discount_value);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Nilai diskon wajib bernilai positif.' });
    }
    if (discount_type.toUpperCase() === 'PERCENTAGE' && val > 100) {
      return res.status(400).json({ success: false, message: 'Nilai diskon persentase tidak boleh melebihi 100%.' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Tanggal mulai dan berakhir wajib diisi.' });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'Tanggal berakhir harus lebih besar atau sama dengan tanggal mulai.' });
    }
    const limit = parseInt(usage_limit, 10);
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ success: false, message: 'Batas penggunaan wajib bernilai positif.' });
    }
    const checkDup = await db.query('SELECT 1 FROM promotion WHERE LOWER(promo_code) = LOWER($1) AND promotion_id <> $2', [promo_code.trim(), id]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Kode promo "' + promo_code.trim().toUpperCase() + '" sudah digunakan oleh promosi lain.' });
    }
    const result = await db.query(`
      UPDATE promotion 
      SET promo_code = $1, discount_type = $2, discount_value = $3, start_date = $4, end_date = $5, usage_limit = $6
      WHERE promotion_id = $7
      RETURNING promotion_id
    `, [promo_code.trim().toUpperCase(), discount_type.toUpperCase(), val, start_date, end_date, limit, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Promosi tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Promosi berhasil diperbarui.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
exports.deletePromotion = async (req, res) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Admin yang dapat menghapus promosi.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    await client.query('DELETE FROM order_promotion WHERE promotion_id = $1', [id]);
    const result = await client.query('DELETE FROM promotion WHERE promotion_id = $1 RETURNING promo_code', [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Promosi tidak ditemukan.' });
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Promosi "' + result.rows[0].promo_code + '" berhasil dihapus.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
