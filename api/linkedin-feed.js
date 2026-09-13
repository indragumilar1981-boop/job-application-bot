const app = require('../server');

module.exports = (req, res) => {
  req.url = '/linkedin-feed';
  return app(req, res);
};
