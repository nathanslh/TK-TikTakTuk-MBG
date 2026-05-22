const db = require('../config/db');
exports.renderRegister = (req, res) => {
  res.render('register', {
    title: 'Daftar'
  });
};
exports.renderRegisterCustomer = (req, res) => {
  res.render('register_customer', {
    title: 'Register Customer - TikTakTuk'
  });
};
exports.renderRegisterOrganizer = (req, res) => {
  res.render('register_organizer', {
    title: 'Register Organizer - TikTakTuk'
  });
};
exports.renderRegisterAdmin = (req, res) => {
  res.render('register_admin', {
    title: 'Register Admin - TikTakTuk'
  });
};
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Error: Username dan password wajib diisi.'
      });
    }
    const userResult = await db.query(
      `
        SELECT
          ua.user_id,
          ua.username,
          ua.password,
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
        WHERE LOWER(ua.username) = LOWER($1)
        GROUP BY ua.user_id, ua.username, ua.password
        LIMIT 1
      `,
      [username]
    );
    if (userResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: `Error: Username "${username}" tidak ditemukan.`
      });
    }
    const user = userResult.rows[0];
    if (String(user.password) !== String(password)) {
      return res.status(400).json({
        success: false,
        message: 'Error: Password salah.'
      });
    }
    const roleList = String(user.roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    const roleName = roleList.includes('ADMIN')
      ? 'ADMIN'
      : roleList.includes('ORGANIZER')
        ? 'ORGANIZER'
        : 'CUSTOMER';
    const encodedUsername = encodeURIComponent(user.username);
    const redirectUrl = roleName === 'ADMIN'
      ? `/admin?username=${encodedUsername}`
      : roleName === 'ORGANIZER'
        ? `/organizer/dashboard?username=${encodedUsername}`
        : `/dashboard?username=${encodedUsername}`;
    return res.json({
      success: true,
      message: `Login berhasil sebagai ${roleName.toLowerCase()}.`,
      redirectUrl,
      role: roleName,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: roleName
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error: ' + err.message
    });
  }
};
exports.registerCustomer = async (req, res) => {
  try {
    const { full_name, email, phone, username, password } = req.body;
    const result = await db.query(
      'SELECT * FROM register_customer($1, $2, $3, $4, $5)',
      [username, password, full_name, email, phone || null]
    );
    const row = result.rows[0];
    if (row.success) {
      return res.json({ success: true, message: row.message });
    } else {
      return res.status(400).json({ success: false, message: row.message });
    }
  } catch (err) {
    console.error('Register customer error:', err.message);
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};
exports.registerOrganizer = async (req, res) => {
  try {
    const { org_name, contact, username, password } = req.body;
    const result = await db.query(
      'SELECT * FROM register_organizer($1, $2, $3, $4)',
      [username, password, org_name, contact || null]
    );
    const row = result.rows[0];
    if (row.success) {
      return res.json({ success: true, message: row.message });
    } else {
      return res.status(400).json({ success: false, message: row.message });
    }
  } catch (err) {
    console.error('Register organizer error:', err.message);
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};
exports.registerAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db.query(
      'SELECT * FROM register_admin($1, $2)',
      [username, password]
    );
    const row = result.rows[0];
    if (row.success) {
      return res.json({ success: true, message: row.message });
    } else {
      return res.status(400).json({ success: false, message: row.message });
    }
  } catch (err) {
    console.error('Register admin error:', err.message);
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};
exports.logout = (req, res) => {
  return res.redirect('/');
};
