const app = require('../server');

module.exports = (req, res) => {
  req.url = '/search';
  return app(req, res);
};
