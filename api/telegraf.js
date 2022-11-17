const webhookCallback = require('../index');

module.exports = (req, res) => {
    if(req.url == '/api/telegraf') {
        res.status(200).send({
            status: 'ok',
            url: req.url,
            query: req.query,
            body: req.body
        });
    } else if(req.url == '/api/telegraf/' + process.env.SHARE_TIKTOK_BOT_TOKEN) {
        webhookCallback(req,res);
    }
};