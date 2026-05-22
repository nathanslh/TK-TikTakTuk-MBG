const { getProfileAccount, getRoleAccount } = require('../utils/helpers');
exports.index = async (req, res, next) => {
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
    res.render('home', {
      title: 'Beranda - TikTakTuk',
      user,
      ticketCount: 5,
      eventCount: 12,
      promoCount: 3,
      totalSpent: 2500000,
      upcomingTickets: [
        {
          id: 1,
          event_name: 'Konser Melodi Senja',
          date: '2024-05-15',
          venue: 'Jakarta Convention Center',
          tier: 'VVIP'
        }
      ],
      featuredEvents: [
        {
          id: 1,
          name: 'Konser Melodi Senja',
          date: '2024-05-15',
          venue: 'Jakarta Convention Center',
          category: 'music',
          price_start: 250000,
          image: '/images/event1.jpg'
        },
        {
          id: 2,
          name: 'Workshop Photography',
          date: '2024-05-20',
          venue: 'Bandung Creative Hub',
          category: 'workshop',
          price_start: 150000,
          image: '/images/event2.jpg'
        }
      ]
    });
  } catch (err) {
    next(err);
  }
};
