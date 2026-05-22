const db = require('../config/db');
const { getRoleAccount, getVenuePageData } = require('../utils/helpers');
exports.adminVenues = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) {
      return res.status(404).render('error-404', { title: 'Admin Tidak Ditemukan' });
    }
    const venueData = await getVenuePageData();
    return res.render('venue_management', {
      title: 'Manajemen Venue - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0] || admin.display_name,
        full_name: admin.display_name,
        username: admin.username
      },
      ...venueData
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerVenues = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) {
      return res.status(404).render('error-404', { title: 'Organizer Tidak Ditemukan' });
    }
    const venueData = await getVenuePageData();
    return res.render('venue_management', {
      title: 'Manajemen Venue - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0] || organizer.display_name,
        full_name: organizer.display_name,
        username: organizer.username
      },
      ...venueData
    });
  } catch (err) {
    return next(err);
  }
};
exports.customerVenues = async (req, res, next) => {
  try {
    const customer = await getRoleAccount('CUSTOMER', req.query.username);
    if (!customer) {
      return res.status(404).render('error-404', { title: 'Customer Tidak Ditemukan' });
    }
    const venueData = await getVenuePageData();
    return res.render('venue_management', {
      title: 'Venue - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'CUSTOMER',
        first_name: customer.display_name.split(' ')[0] || customer.display_name,
        full_name: customer.display_name,
        username: customer.username
      },
      ...venueData
    });
  } catch (err) {
    return next(err);
  }
};
exports.createVenue = async (req, res, next) => {
  try {
    const { venue_name, city, address, capacity, has_reserved_seating } = req.body;
    if (!venue_name || !city || !address || !capacity) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (Number(capacity) <= 0) {
      return res.status(400).json({ success: false, message: 'Kapasitas harus lebih dari 0.' });
    }
    const result = await db.query(
      `INSERT INTO venue (venue_id, venue_name, capacity, address, city) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING venue_id`,
      [venue_name.trim(), Number(capacity), address.trim(), city.trim()]
    );
    const newVenueId = result.rows[0].venue_id;
    if (has_reserved_seating) {
      await db.query(
        `INSERT INTO seat (seat_id, section, seat_number, row_number, venue_id) VALUES (gen_random_uuid(), 'REGULER', 'A1', '1', $1)`,
        [newVenueId]
      );
    }
    return res.json({
      success: true,
      message: 'Venue "' + venue_name.trim() + '" berhasil ditambahkan!',
      venue_id: newVenueId
    });
  } catch (err) {
    console.error('Create venue error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.updateVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { venue_name, city, address, capacity, has_reserved_seating } = req.body;
    if (!venue_name || !city || !address || !capacity) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (Number(capacity) <= 0) {
      return res.status(400).json({ success: false, message: 'Kapasitas harus lebih dari 0.' });
    }
    const result = await db.query(
      `UPDATE venue SET venue_name = $1, capacity = $2, address = $3, city = $4 WHERE venue_id = $5 RETURNING venue_id`,
      [venue_name.trim(), Number(capacity), address.trim(), city.trim(), id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Venue tidak ditemukan.' });
    }
    const existingSeats = await db.query('SELECT COUNT(*)::int AS cnt FROM seat WHERE venue_id = $1', [id]);
    const currentlyHasSeats = existingSeats.rows[0].cnt > 0;
    if (has_reserved_seating && !currentlyHasSeats) {
      await db.query(
        `INSERT INTO seat (seat_id, section, seat_number, row_number, venue_id) VALUES (gen_random_uuid(), 'REGULER', 'A1', '1', $1)`,
        [id]
      );
    } else if (!has_reserved_seating && currentlyHasSeats) {
      await db.query('DELETE FROM seat WHERE venue_id = $1', [id]);
    }
    return res.json({
      success: true,
      message: 'Venue "' + venue_name.trim() + '" berhasil diperbarui!'
    });
  } catch (err) {
    console.error('Update venue error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.deleteVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('BEGIN');
    await db.query(`
      DELETE FROM seat 
      WHERE venue_id = $1 
    `, [id]);
    const result = await db.query('DELETE FROM venue WHERE venue_id = $1 RETURNING venue_name', [id]);
    if (result.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Venue tidak ditemukan.' });
    }
    await db.query('COMMIT');
    return res.json({
      success: true,
      message: 'Venue "' + result.rows[0].venue_name + '" berhasil dihapus!'
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Delete venue error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
