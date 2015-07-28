/**
 * Created by Roman on 09.02.2015.
 */
var express = require('express');
var router = express.Router();
var MessageHandler = require('../handlers/messages');
var SessionHandler = require('../handlers/sessions');

var NewMessageHandler = require('../handlers/newMessages');

module.exports = function(db, app) {
    var session = new SessionHandler(db);
    var messages = new MessageHandler(db, app);
    var newMessages = new NewMessageHandler( app, db );

    /*router.post( '/send', session.authenticatedUser, messages.sendMessage );*/
    router.post( '/send', session.authenticatedUser, newMessages.sendMessage );
    router.get('/unread/:num1/:num2', session.authenticatedUser, messages.getUnReadCount );
    router.put('/read', session.authenticatedUser, messages.setRead );
    router.get( '/get/:message_uuid', session.authenticatedUser, messages.messageInfo );
    router.get( '/conversations/:src/:dst', session.authenticatedUser, messages.getConversations );
    /*router.post( '/received', session.authenticatedUser, messages.postMessage );*/

    router.get( '/lastchats', session.authenticatedUser, messages.getLastByChats );
    router.get( '/recent', session.authenticatedUser, messages.getRecentCompanion );
    router.delete( '/', session.authenticatedUser, messages.deleteOneMessage );
    router.delete( '/chats', session.authenticatedUser, messages.deleteChat );
    router.delete( '/:id', session.authenticatedUser, messages.deleteOneMessage );
    router.delete( '/:n1/:n2', session.authenticatedUser, messages.deleteChat);
    router.post('/plivo', newMessages.getPlivoInboundSMS );


    return router;
};

