const webhookCallback = require('../index');

module.exports = (req, res) => {
    webhookCallback(req,res);
};