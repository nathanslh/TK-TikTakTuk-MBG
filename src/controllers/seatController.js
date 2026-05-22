const db = require('../config/db');
const { getProfileAccount } = require('../utils/helpers');
exports.listSeats = async (req, res, next) => {
  try {
    const account = await getProfileAccount(req.query.username);
    if (!account) {
      return res.status(404).render('error-404', { title: 'Profil Tidak Ditemukan' });
    }
    const roleList = String(account.roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    const primaryRole = roleList.includes('ADMIN')
      ? 'ADMIN'
      : roleList.includes('ORGANIZER')
        ? 'ORGANIZER'
        : 'CUSTOMER';
    const isReadOnly = !(primaryRole === 'ADMIN' || primaryRole === 'ORGANIZER');
    const seatsResult = await db.query(`
      SELECT 
        s.seat_id AS id, 
        s.section, 
        s.seat_number AS num, 
        s.row_number AS row, 
        s.venue_id, 
        v.venue_name AS venue, 
        CASE 
          WHEN EXISTS (SELECT 1 FROM has_relationship hr WHERE hr.seat_id = s.seat_id) THEN 'occupied' 
          ELSE 'available' 
        END AS status
      FROM seat s
      JOIN venue v ON v.venue_id = s.venue_id
      ORDER BY v.venue_name ASC, s.section ASC, s.row_number ASC, s.seat_number ASC
    `);
    const venuesResult = await db.query('SELECT venue_id AS id, venue_name AS name FROM venue ORDER BY venue_name ASC');
    return res.render('seats', {
      title: 'Manajemen Kursi - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: primaryRole === 'ADMIN',
        role: primaryRole,
        first_name: account.display_name.split(' ')[0] || account.display_name,
        full_name: account.display_name,
        username: account.username
      },
      seats: seatsResult.rows,
      venues: venuesResult.rows,
      role: primaryRole.toLowerCase(),
      isReadOnly
    });
  } catch (err) {
    return next(err);
  }
};
exports.createSeat = async (req, res) => {
  try {
    const venue_id = req.body.venue_id || req.body.venue;
    const section = req.body.section;
    const row_number = req.body.row_number || req.body.row;
    const seat_number = req.body.seat_number || req.body.num;
    if (!venue_id || !section || !row_number || !seat_number) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    const duplicate = await db.query(
      `SELECT 1 FROM seat WHERE venue_id = $1 AND LOWER(section) = LOWER($2) AND LOWER(row_number) = LOWER($3) AND LOWER(seat_number) = LOWER($4) LIMIT 1`,
      [venue_id, section.trim(), row_number.trim(), seat_number.trim()]
    );
    if (duplicate.rowCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kursi dengan kombinasi Venue, Section, Baris, dan Nomor ini sudah terdaftar.' 
      });
    }
    const result = await db.query(
      `INSERT INTO seat (seat_id, section, row_number, seat_number, venue_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING seat_id`,
      [section.trim(), row_number.trim(), seat_number.trim(), venue_id]
    );
    return res.json({
      success: true,
      message: 'Kursi berhasil ditambahkan!',
      seat_id: result.rows[0].seat_id
    });
  } catch (err) {
    console.error('Create seat error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.updateSeat = async (req, res) => {
  try {
    const { id } = req.params;
    const venue_id = req.body.venue_id || req.body.venue;
    const section = req.body.section;
    const row_number = req.body.row_number || req.body.row;
    const seat_number = req.body.seat_number || req.body.num;
    if (!venue_id || !section || !row_number || !seat_number) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    const duplicate = await db.query(
      `SELECT 1 FROM seat WHERE venue_id = $1 AND LOWER(section) = LOWER($2) AND LOWER(row_number) = LOWER($3) AND LOWER(seat_number) = LOWER($4) AND seat_id <> $5 LIMIT 1`,
      [venue_id, section.trim(), row_number.trim(), seat_number.trim(), id]
    );
    if (duplicate.rowCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kursi dengan kombinasi Venue, Section, Baris, dan Nomor ini sudah terdaftar.' 
      });
    }
    const result = await db.query(
      `UPDATE seat SET section = $1, row_number = $2, seat_number = $3, venue_id = $4 WHERE seat_id = $5`,
      [section.trim(), row_number.trim(), seat_number.trim(), venue_id, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Kursi tidak ditemukan.' });
    }
    return res.json({
      success: true,
      message: 'Perubahan berhasil disimpan!'
    });
  } catch (err) {
    console.error('Update seat error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.deleteSeat = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM seat WHERE seat_id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Kursi tidak ditemukan.' });
    }
    return res.json({
      success: true,
      message: 'Kursi berhasil dihapus!'
    });
  } catch (err) {
    console.error('Delete seat error:', err.message);
    let cleanMessage = err.message || 'Gagal menghapus kursi.';
    if (cleanMessage.includes('ERROR:')) {
      const idx = cleanMessage.indexOf('ERROR:');
      cleanMessage = cleanMessage.substring(idx);
    }
    return res.status(400).json({ success: false, message: cleanMessage });
  }
};
