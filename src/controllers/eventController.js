const db = require('../config/db');
const { getRoleAccount, getEventPageData } = require('../utils/helpers');
exports.customerEvents = async (req, res, next) => {
  try {
    const customer = await getRoleAccount('CUSTOMER', req.query.username);
    if (!customer) return res.status(404).render('error-404', { title: 'Customer Tidak Ditemukan' });
    const data = await getEventPageData();
    return res.render('event_management', {
      title: 'Cari Event - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'CUSTOMER',
        first_name: customer.display_name.split(' ')[0],
        full_name: customer.display_name,
        username: customer.username
      },
      ...data
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerEvents = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) return res.status(404).render('error-404', { title: 'Organizer Tidak Ditemukan' });
    const data = await getEventPageData();
    return res.render('event_management', {
      title: 'Event Saya - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0],
        full_name: organizer.display_name,
        username: organizer.username
      },
      ...data
    });
  } catch (err) {
    return next(err);
  }
};
exports.adminEvents = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) return res.status(404).render('error-404', { title: 'Admin Tidak Ditemukan' });
    const data = await getEventPageData();
    return res.render('event_management', {
      title: 'Manajemen Event - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0],
        full_name: admin.display_name,
        username: admin.username
      },
      ...data
    });
  } catch (err) {
    return next(err);
  }
};
exports.createEvent = async (req, res, next) => {
  try {
    const { title, date, time, venue_id, artists, description, ticket_categories } = req.body;
    if (!title || !date || !time || !venue_id) {
      return res.status(400).json({ success: false, message: 'Judul, tanggal, waktu, dan venue wajib diisi.' });
    }
    const orgResult = await db.query('SELECT organizer_id FROM organizer LIMIT 1');
    const organizerId = orgResult.rows[0]?.organizer_id;
    if (!organizerId) return res.status(400).json({ success: false, message: 'Tidak ada organizer terdaftar.' });
    const eventDatetime = date + ' ' + time + ':00';
    const eventResult = await db.query(
      'INSERT INTO event (event_id, event_datetime, event_title, venue_id, organizer_id) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING event_id',
      [eventDatetime, title.trim(), venue_id, organizerId]
    );
    const newEventId = eventResult.rows[0].event_id;
    if (Array.isArray(artists) && artists.length > 0) {
      for (const artistId of artists) {
        if (artistId && artistId.trim()) {
          try {
            await db.query('INSERT INTO event_artist (event_id, artist_id) VALUES ($1, $2)', [newEventId, artistId.trim()]);
          } catch (err) {
            throw new Error(err.message);
          }
        }
      }
    }
    if (Array.isArray(ticket_categories)) {
      for (const tc of ticket_categories) {
        if (tc.name && tc.price >= 0 && tc.quota > 0) {
          await db.query(
            'INSERT INTO ticket_category (category_id, category_name, quota, price, tevent_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
            [tc.name.trim(), Number(tc.quota), Number(tc.price), newEventId]
          );
        }
      }
    }
    return res.json({ success: true, message: 'Event "' + title.trim() + '" berhasil dibuat!' });
  } catch (err) {
    console.error('Create event error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, date, time, venue_id, artists, description, ticket_categories } = req.body;
    if (!title || !date || !time || !venue_id) {
      return res.status(400).json({ success: false, message: 'Judul, tanggal, waktu, dan venue wajib diisi.' });
    }
    const eventDatetime = date + ' ' + time + ':00';
    const result = await db.query(
      'UPDATE event SET event_title = $1, event_datetime = $2, venue_id = $3 WHERE event_id = $4 RETURNING event_id',
      [title.trim(), eventDatetime, venue_id, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan.' });
    await db.query('DELETE FROM event_artist WHERE event_id = $1', [id]);
    if (Array.isArray(artists) && artists.length > 0) {
      for (const artistId of artists) {
        if (artistId && artistId.trim()) {
          try {
            await db.query('INSERT INTO event_artist (event_id, artist_id) VALUES ($1, $2)', [id, artistId.trim()]);
          } catch (err) {
            throw new Error(err.message);
          }
        }
      }
    }
    const oldCats = await db.query('SELECT category_id FROM ticket_category WHERE tevent_id = $1', [id]);
    for (const oc of oldCats.rows) {
      const ticketCheck = await db.query('SELECT COUNT(*)::int AS cnt FROM ticket WHERE tcategory_id = $1', [oc.category_id]);
      if (ticketCheck.rows[0].cnt === 0) {
        await db.query('DELETE FROM ticket_category WHERE category_id = $1', [oc.category_id]);
      }
    }
    if (Array.isArray(ticket_categories)) {
      for (const tc of ticket_categories) {
        if (tc.name && tc.price >= 0 && tc.quota > 0) {
          await db.query(
            'INSERT INTO ticket_category (category_id, category_name, quota, price, tevent_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
            [tc.name.trim(), Number(tc.quota), Number(tc.price), id]
          );
        }
      }
    }
    return res.json({ success: true, message: 'Event "' + title.trim() + '" berhasil diperbarui!' });
  } catch (err) {
    console.error('Update event error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM ticket_category WHERE tevent_id = $1', [id]);
    await db.query('DELETE FROM event_artist WHERE event_id = $1', [id]);
    const result = await db.query('DELETE FROM event WHERE event_id = $1 RETURNING event_title', [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Event tidak ditemukan.' });
    return res.json({ success: true, message: 'Event "' + result.rows[0].event_title + '" berhasil dihapus!' });
  } catch (err) {
    console.error('Delete event error:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
