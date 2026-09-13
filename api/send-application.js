const app = require('../server');

module.exports = (req, res) => {
  req.url = '/send-application';
  return app(req, res);
};
