const app = require('../server');

module.exports = (req, res) => {
  req.url = '/parse-linkedin-job';
  return app(req, res);
};
