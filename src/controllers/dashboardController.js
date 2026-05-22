const db = require('../config/db');
const {
  getRoleAccount,
  getProfileAccount,
  getCustomerDashboardData,
  getAdminDashboardData,
  getOrganizerDashboardData
} = require('../utils/helpers');
exports.customerDashboard = async (req, res, next) => {
  try {
    const customer = await getRoleAccount('CUSTOMER', req.query.username);
    if (!customer) {
      return res.status(404).render('error-404', {
        title: 'Customer Tidak Ditemukan'
      });
    }
    const customerDashboard = await getCustomerDashboardData(customer.user_id);
    return res.render('dashboard_customer', {
      title: 'Customer Dashboard - TikTakTuk',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'CUSTOMER',
        first_name: customer.display_name.split(' ')[0] || customer.display_name,
        full_name: customer.display_name,
        username: customer.username
      },
      customerName: customer.display_name,
      ticketCount: customerDashboard.ticketCount,
      eventCount: customerDashboard.eventCount,
      promoCount: customerDashboard.promoCount,
      totalSpent: customerDashboard.totalSpent,
      upcomingTickets: customerDashboard.upcomingTickets
    });
  } catch (err) {
    return next(err);
  }
};
exports.adminDashboard = async (req, res, next) => {
  try {
    const admin = await getRoleAccount('ADMIN', req.query.username);
    if (!admin) {
      return res.status(404).render('error-404', {
        title: 'Admin Tidak Ditemukan'
      });
    }
    const adminDashboard = await getAdminDashboardData();
    return res.render('dashboard_admin', {
      title: 'Dashboard Admin',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ADMIN',
        first_name: admin.display_name.split(' ')[0] || admin.display_name,
        full_name: admin.display_name,
        username: admin.username
      },
      totalUsers: adminDashboard.totalUsers,
      totalEvents: adminDashboard.totalEvents,
      totalRevenue: adminDashboard.totalRevenue,
      activePromos: adminDashboard.activePromos,
      recentOrders: adminDashboard.recentOrders
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerDashboard = async (req, res, next) => {
  try {
    const organizer = await getRoleAccount('ORGANIZER', req.query.username);
    if (!organizer) {
      return res.status(404).render('error-404', {
        title: 'Organizer Tidak Ditemukan'
      });
    }
    const organizerDashboard = await getOrganizerDashboardData(organizer.user_id, organizer.display_name);
    return res.render('dashboard_organizer', {
      title: 'Organizer Dashboard',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'ORGANIZER',
        first_name: organizer.display_name.split(' ')[0] || organizer.display_name,
        full_name: organizer.display_name,
        username: organizer.username
      },
      organizerName: organizerDashboard.organizerName,
      eventCount: organizerDashboard.eventCount,
      revenue: organizerDashboard.revenue,
      ticketsSold: organizerDashboard.ticketsSold,
      attendees: organizerDashboard.attendees,
      upcomingEvents: organizerDashboard.upcomingEvents
    });
  } catch (err) {
    return next(err);
  }
};
exports.profile = async (req, res, next) => {
  try {
    const account = await getProfileAccount(req.query.username);
    if (!account) {
      return res.status(404).render('error-404', {
        title: 'Profil Tidak Ditemukan'
      });
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
    const baseUser = {
      isAuthenticated: true,
      isStaff: primaryRole === 'ADMIN',
      role: primaryRole,
      first_name: account.display_name.split(' ')[0] || account.display_name,
      full_name: account.display_name,
      username: account.username
    };
    if (primaryRole === 'ADMIN') {
      return res.render('profile_admin', {
        title: 'Profil Admin',
        user: baseUser,
        admin: {
          username: account.username,
          display_name: account.display_name,
          roles: roleList.join(', ') || 'ADMIN'
        }
      });
    }
    if (primaryRole === 'ORGANIZER') {
      return res.render('profile_organizer', {
        title: 'Profil Organizer',
        user: baseUser,
        organizer: {
          username: account.username,
          name: account.organizer_name || account.display_name,
          email: account.organizer_email || account.email,
          phone_number: account.phone_number || '-'
        }
      });
    }
    return res.render('profile_customer', {
      title: 'Profil Pelanggan',
      user: baseUser,
      customer: {
        username: account.username,
        full_name: account.customer_full_name || account.display_name,
        email: account.email,
        phone_number: account.phone_number || '-'
      },
      username: account.username
    });
  } catch (err) {
    return next(err);
  }
};
exports.organizerProfile = async (req, res, next) => {
  try {
    const account = await getProfileAccount(req.query.username);
    if (!account) {
      return res.status(404).render('error-404', {
        title: 'Profil Organizer Tidak Ditemukan'
      });
    }
    return res.render('profile_organizer', {
      title: 'Profil Organizer',
      user: {
        isAuthenticated: true,
        isStaff: false,
        role: 'ORGANIZER',
        first_name: account.display_name.split(' ')[0] || account.display_name,
        full_name: account.display_name,
        username: account.username
      },
      organizer: {
        username: account.username,
        name: account.organizer_name || account.display_name,
        email: account.organizer_email || account.email,
        phone_number: account.phone_number || '-'
      }
    });
  } catch (err) {
    return next(err);
  }
};
exports.adminProfile = async (req, res, next) => {
  try {
    const account = await getProfileAccount(req.query.username);
    if (!account) {
      return res.status(404).render('error-404', {
        title: 'Profil Admin Tidak Ditemukan'
      });
    }
    const roleList = String(account.roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    return res.render('profile_admin', {
      title: 'Profil Admin',
      user: {
        isAuthenticated: true,
        isStaff: true,
        role: 'ADMIN',
        first_name: account.display_name.split(' ')[0] || account.display_name,
        full_name: account.display_name,
        username: account.username
      },
      admin: {
        username: account.username,
        display_name: account.display_name,
        roles: roleList.join(', ') || 'ADMIN'
      }
    });
  } catch (err) {
    return next(err);
  }
};
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      role,
      current_username,
      username,
      full_name,
      email,
      phone_number,
      organizer_name,
      contact_email
    } = req.body;
    const normalizedRole = String(role || '').toUpperCase();
    const currentUsername = String(current_username || username || '').trim();
    const nextUsername = String(username || current_username || '').trim();
    if (!normalizedRole || !currentUsername) {
      return res.status(400).json({
        success: false,
        message: 'Error: Data profil tidak lengkap.'
      });
    }
    if (nextUsername && !/^[a-zA-Z0-9]+$/.test(nextUsername)) {
      return res.status(400).json({
        success: false,
        message: `Error: Username "${nextUsername}" hanya boleh mengandung huruf dan angka tanpa simbol atau spasi.`
      });
    }
    const account = await getProfileAccount(currentUsername);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: `Error: Username "${currentUsername}" tidak ditemukan.`
      });
    }
    const roleList = String(account.roles || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!roleList.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Error: Role akun tidak sesuai.'
      });
    }
    if (nextUsername && nextUsername.toLowerCase() !== currentUsername.toLowerCase()) {
      const exists = await db.query(
        'SELECT 1 FROM user_account WHERE LOWER(username) = LOWER($1) AND user_id <> $2 LIMIT 1',
        [nextUsername, account.user_id]
      );
      if (exists.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Error: Username "${nextUsername}" sudah terdaftar, gunakan username lain.`
        });
      }
    }
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      if (normalizedRole === 'CUSTOMER') {
        await client.query(
          `
            UPDATE customer
            SET full_name = $1,
                email = $2,
                phone_number = $3
            WHERE user_id = $4
          `,
          [full_name || account.customer_full_name || account.display_name, email || account.email, phone_number || account.phone_number || '', account.user_id]
        );
      } else if (normalizedRole === 'ORGANIZER') {
        await client.query(
          `
            UPDATE organizer
            SET organizer_name = $1,
                contact_email = $2
            WHERE user_id = $3
          `,
          [organizer_name || account.organizer_name || account.display_name, contact_email || account.organizer_email || account.email, account.user_id]
        );
      }
      if (nextUsername && nextUsername.toLowerCase() !== currentUsername.toLowerCase()) {
        await client.query(
          'UPDATE user_account SET username = $1 WHERE user_id = $2',
          [nextUsername, account.user_id]
        );
      }
      await client.query('COMMIT');
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }
    const updatedUsername = nextUsername || currentUsername;
    const updatedAccount = await getProfileAccount(updatedUsername);
    const redirectUrl = normalizedRole === 'ADMIN'
      ? `/admin/profile?username=${encodeURIComponent(updatedUsername)}`
      : normalizedRole === 'ORGANIZER'
        ? `/organizer/profile?username=${encodeURIComponent(updatedUsername)}`
        : `/profile?username=${encodeURIComponent(updatedUsername)}`;
    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      redirectUrl,
      profile: updatedAccount,
      role: normalizedRole
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    return next(err);
  }
};
exports.changePassword = async (req, res, next) => {
  try {
    const {
      current_username,
      role,
      old_password,
      new_password,
      confirm_new_password
    } = req.body;
    const normalizedRole = String(role || '').toUpperCase();
    const currentUsername = String(current_username || '').trim();
    const oldPassword = String(old_password || '');
    const nextPassword = String(new_password || '');
    const confirmPassword = String(confirm_new_password || '');
    if (!normalizedRole || !currentUsername) {
      return res.status(400).json({
        success: false,
        message: 'Error: Data profil tidak lengkap.'
      });
    }
    if (!oldPassword || !nextPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Error: Semua field password wajib diisi.'
      });
    }
    if (nextPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Error: Password baru minimal 6 karakter.'
      });
    }
    if (nextPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Error: Konfirmasi password baru tidak sama.'
      });
    }
    const account = await getProfileAccount(currentUsername);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: `Error: Username "${currentUsername}" tidak ditemukan.`
      });
    }
    const roleList = String(account.roles || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!roleList.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Error: Role akun tidak sesuai.'
      });
    }
    const passwordResult = await db.query(
      'SELECT password FROM user_account WHERE user_id = $1 LIMIT 1',
      [account.user_id]
    );
    if (passwordResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error: Akun tidak ditemukan.'
      });
    }
    const currentPassword = String(passwordResult.rows[0].password || '');
    if (currentPassword !== oldPassword) {
      return res.status(400).json({
        success: false,
        message: 'Error: Password lama salah.'
      });
    }
    await db.query(
      'UPDATE user_account SET password = $1 WHERE user_id = $2',
      [nextPassword, account.user_id]
    );
    return res.json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (err) {
    return next(err);
  }
};
