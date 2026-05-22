const db = require('../config/db');
const { getRoleAccount } = require('../utils/helpers');
exports.adminTicketCategories = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(404).render('error-404', { title: 'Admin Tidak Ditemukan' });
    const eventsResult = await db.query('SELECT event_id, event_title FROM event ORDER BY event_title');
    const catResult = await db.query(`
      SELECT tc.category_id, tc.category_name, tc.price, tc.quota, tc.tevent_id, e.event_title as event_name,
      COALESCE(rq.sisa_kuota, tc.quota) AS sisa_kuota
      FROM ticket_category tc
      JOIN event e ON tc.tevent_id = e.event_id
      LEFT JOIN get_remaining_quota_by_event(tc.tevent_id) rq ON rq.category_id = tc.category_id
      ORDER BY e.event_title ASC, tc.category_name ASC
    `);
    return res.render('ticket_category_management', {
      title: 'Manajemen Kategori Tiket - TikTakTuk',
      user: { 
        isAuthenticated: true, isStaff: true, role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0], 
        full_name: admin.display_name, 
        username: admin.username 
      },
      events: eventsResult.rows,
      categories: catResult.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerTicketCategories = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) return res.status(404).render('error-404', { title: 'Organizer Tidak Ditemukan' });
    const eventsResult = await db.query('SELECT event_id, event_title FROM event ORDER BY event_title');
    const catResult = await db.query(`
      SELECT tc.category_id, tc.category_name, tc.price, tc.quota, tc.tevent_id, e.event_title as event_name,
      COALESCE(rq.sisa_kuota, tc.quota) AS sisa_kuota
      FROM ticket_category tc
      JOIN event e ON tc.tevent_id = e.event_id
      LEFT JOIN get_remaining_quota_by_event(tc.tevent_id) rq ON rq.category_id = tc.category_id
      ORDER BY e.event_title ASC, tc.category_name ASC
    `);
    return res.render('ticket_category_management', {
      title: 'Manajemen Kategori Tiket - TikTakTuk',
      user: { 
        isAuthenticated: true, isStaff: true, role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0], 
        full_name: organizer.display_name, 
        username: organizer.username 
      },
      events: eventsResult.rows,
      categories: catResult.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.customerTicketCategories = async (req, res, next) => {
  try {
    const customer = await getRoleAccount('CUSTOMER', req.query.username);
    if (!customer) return res.status(404).render('error-404', { title: 'Customer Tidak Ditemukan' });
    const eventsResult = await db.query('SELECT event_id, event_title FROM event ORDER BY event_title');
    const catResult = await db.query(`
      SELECT tc.category_id, tc.category_name, tc.price, tc.quota, tc.tevent_id, e.event_title as event_name,
      COALESCE(rq.sisa_kuota, tc.quota) AS sisa_kuota
      FROM ticket_category tc
      JOIN event e ON tc.tevent_id = e.event_id
      LEFT JOIN get_remaining_quota_by_event(tc.tevent_id) rq ON rq.category_id = tc.category_id
      ORDER BY e.event_title ASC, tc.category_name ASC
    `);
    return res.render('ticket_category_management', {
      title: 'Kategori Tiket - TikTakTuk',
      user: { 
        isAuthenticated: true, isStaff: false, role: 'CUSTOMER',
        first_name: customer.display_name.split(' ')[0], 
        full_name: customer.display_name, 
        username: customer.username 
      },
      events: eventsResult.rows,
      categories: catResult.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.createCategory = async (req, res, next) => {
  try {
    const { tevent_id, category_name, quota, price } = req.body;
    if (!tevent_id || !category_name || isNaN(quota) || isNaN(price)) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi dengan benar.' });
    }
    if (quota <= 0) return res.status(400).json({ success: false, message: 'Quota harus bilangan bulat positif (> 0).' });
    if (price < 0) return res.status(400).json({ success: false, message: 'Price harus bilangan tidak negatif (>= 0).' });
    await db.query(
      'INSERT INTO ticket_category (category_id, category_name, quota, price, tevent_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
      [category_name.trim(), quota, price, tevent_id]
    );
    return res.json({ success: true, message: 'Kategori tiket berhasil ditambahkan.' });
  } catch (err) {
    console.error('Create TC error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tevent_id, category_name, quota, price } = req.body;
    if (!tevent_id || !category_name || isNaN(quota) || isNaN(price)) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi dengan benar.' });
    }
    if (quota <= 0) return res.status(400).json({ success: false, message: 'Quota harus bilangan bulat positif (> 0).' });
    if (price < 0) return res.status(400).json({ success: false, message: 'Price harus bilangan tidak negatif (>= 0).' });
    const result = await db.query(
      'UPDATE ticket_category SET category_name = $1, quota = $2, price = $3, tevent_id = $4 WHERE category_id = $5 RETURNING category_id',
      [category_name.trim(), quota, price, tevent_id, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tiket tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Data kategori tiket berhasil diperbarui.' });
  } catch (err) {
    console.error('Update TC error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM ticket_category WHERE category_id = $1 RETURNING category_name', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tiket tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Kategori tiket "' + result.rows[0].category_name + '" berhasil dihapus.' });
  } catch (err) {
    console.error('Delete TC error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
