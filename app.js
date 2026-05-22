require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./src/config/env');
const app = express();
app.set('env', config.isProduction ? 'production' : 'development');
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, '..', 'tiktaktuk', 'main', 'static', 'images')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (config.isProduction && config.allowedHosts.length > 0) {
  app.use((req, res, next) => {
    const requestHost = (req.hostname || '').toLowerCase();
    if (config.allowedHosts.includes(requestHost)) {
      return next();
    }
    return res.status(400).send('Invalid host header');
  });
}
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use((req, res, next) => {
  res.locals.user = null;
  res.locals.csrfToken = '';
  res.locals.meta = [];
  res.locals.styles = [];
  next();
});
app.use('/', require('./src/routes/index'));
app.use((req, res) => {
  res.status(404).render('error-404', {
    title: 'Halaman Tidak Ditemukan'
  });
});
app.use((err, req, res, next) => {
  if (config.debug) {
    console.error(err.stack);
  } else {
    console.error(err.message);
  }
  res.status(500).render('error-500', {
    title: 'Server Error',
    error: config.debug ? err : null
  });
});
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(
      `Server berjalan di http://localhost:${config.port} (${config.isProduction ? 'production' : 'development'})`
    );
  });
}
module.exports = app;
