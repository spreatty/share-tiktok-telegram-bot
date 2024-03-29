const text = require('./text');

module.exports = {
    whatFor: {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: text.whatForOptions.source,
                    callback_data: 'link source'
                }], [{
                    text: text.whatForOptions.target,
                    callback_data: 'link target'
                }], [{
                    text: text.whatForOptions.both,
                    callback_data: 'link both'
                }]
            ]
        }
    },
    selectChat(linkId) {
        return  {
            reply_markup: {
                inline_keyboard: [[{
                    text: text.selectChat.button,
                    switch_inline_query: 'link ' + linkId
                }]]
            }
        };
    },
    unlinkLoop: {
        reply_markup: {
            inline_keyboard: [[{
                text: text.unlink.button,
                callback_data: `unlink loop`
            }]]
        }
    },
    buttons(buttons) {
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    },
    noPreview: {
        disable_web_page_preview: true
    }
}