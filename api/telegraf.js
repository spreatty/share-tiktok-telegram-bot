module.exports = (req, res) => {
    res.status(200).send({
        status: 'ok',
        url: req.url,
        query: req.query,
        body: req.body
    });
};