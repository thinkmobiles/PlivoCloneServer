'use strict';

var express = require('express');
var router = express.Router();
var SessionHandler = require('../handlers/sessions');
var VoiceMessagesHandler = require('../handlers/voiceMessages');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

module.exports = function( app, db) {
    var session = new SessionHandler(db);
    var voiceMessagesHandler = new VoiceMessagesHandler(app, db);

    router.get('/form', session.authenticatedUser, voiceMessagesHandler.sendTestForm); //TODO: use only for tests, remove on production;

    router.post('/send', session.authenticatedUser, multipartMiddleware, voiceMessagesHandler.sendMessage);
    router.get('/audio/:fileName', voiceMessagesHandler.getAudioFile);

    router.get('/delete/old/messages', voiceMessagesHandler.testDeleteOldMessages); //TODO: use only for tests, remove on production;
    router.get('/numbers', voiceMessagesHandler.testGetNumberPriceByCountry); //TODO: use only for tests, remove on production;

    router.get('/providers', voiceMessagesHandler.testGetCheapestProviderByCountry); //TODO: use only for tests, remove on production;

    return router;
};

