/**
 * Created by Roman on 09.02.2015.
 */
var express = require('express');
var router = express.Router();
var MessageHandler = require('../handlers/messages');
var SessionHandler = require('../handlers/sessions');

module.exports = function(db, app) {
    var session = new SessionHandler(db);
    var messages = new MessageHandler(db, app);

    router.post( '/send', session.authenticatedUser, messages.sendMessage );
    router.get( '/get/:message_uuid', session.authenticatedUser, messages.messageInfo );
    //router.get( '/lastConversations', session.authenticatedUser, messages.getLastConversations );
    router.get( '/conversations/:src/:dst', session.authenticatedUser, messages.getConversations );
    //router.get( '/conversations', session.authenticatedUser, messages.getConversations );
    router.post( '/received', session.authenticatedUser, messages.postMessage );

    router.get( '/lastchats', session.authenticatedUser, messages.getLastByChats );
    router.get( '/recent', session.authenticatedUser, messages.getRecentCompanion );


    return router;
};

