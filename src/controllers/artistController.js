const db = require('../config/db');
const { getRoleAccount } = require('../utils/helpers');
exports.adminArtists = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(404).render('error-404', { title: 'Admin Tidak Ditemukan' });
    const result = await db.query('SELECT artist_id, name, genre FROM artist ORDER BY name ASC');
    return res.render('artist_management', {
      title: 'Manajemen Artist - TikTakTuk',
      user: {
        isAuthenticated: true, isStaff: true, role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0],
        full_name: admin.display_name,
        username: admin.username
      },
      artists: result.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.customerArtists = async (req, res, next) => {
  try {
    const customer = await getRoleAccount('CUSTOMER', req.query.username);
    if (!customer) return res.status(404).render('error-404', { title: 'Customer Tidak Ditemukan' });
    const result = await db.query('SELECT artist_id, name, genre FROM artist ORDER BY name ASC');
    return res.render('artist_management', {
      title: 'Daftar Artist - TikTakTuk',
      user: {
        isAuthenticated: true, isStaff: false, role: 'CUSTOMER',
        first_name: customer.display_name.split(' ')[0],
        full_name: customer.display_name,
        username: customer.username
      },
      artists: result.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerArtists = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) return res.status(404).render('error-404', { title: 'Organizer Tidak Ditemukan' });
    const result = await db.query('SELECT artist_id, name, genre FROM artist ORDER BY name ASC');
    return res.render('artist_management', {
      title: 'Daftar Artist - TikTakTuk',
      user: {
        isAuthenticated: true, isStaff: true, role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0],
        full_name: organizer.display_name,
        username: organizer.username
      },
      artists: result.rows
    });
  } catch (err) {
    return next(err);
  }
};
exports.createArtist = async (req, res, next) => {
  try {
    const { name, genre } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name wajib diisi.' });
    }
    await db.query(
      'INSERT INTO artist (artist_id, name, genre) VALUES (gen_random_uuid(), $1, $2) RETURNING artist_id',
      [name.trim(), genre ? genre.trim() : null]
    );
    return res.json({ success: true, message: 'Artist "' + name.trim() + '" berhasil ditambahkan.' });
  } catch (err) {
    console.error('Create artist error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.updateArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, genre } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name wajib diisi.' });
    }
    const result = await db.query(
      'UPDATE artist SET name = $1, genre = $2 WHERE artist_id = $3 RETURNING artist_id',
      [name.trim(), genre ? genre.trim() : null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Artist tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Data artist berhasil diperbarui.' });
  } catch (err) {
    console.error('Update artist error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.deleteArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM event_artist WHERE artist_id = $1', [id]);
    const result = await db.query('DELETE FROM artist WHERE artist_id = $1 RETURNING name', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Artist tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Artist "' + result.rows[0].name + '" berhasil dihapus.' });
  } catch (err) {
    console.error('Delete artist error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
