module.exports = {
    whatFor: {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: text.whatForOptions.source,
                    callback_data: 'source'
                }], [{
                    text: text.whatForOptions.target,
                    callback_data: 'target'
                }], [{
                    text: text.whatForOptions.both,
                    callback_data: 'both'
                }]
            ]
        }
    },
    noPreview: {
        disable_web_page_preview: true
    }
}