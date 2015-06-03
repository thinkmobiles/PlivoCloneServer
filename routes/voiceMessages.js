'use strict';

var express = require('express');
var router = express.Router();
var SessionHandler = require('../handlers/sessions');
var VoiceMessagesHandler = require('../handlers/voiceMessages');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

module.exports = function(db) {
    var session = new SessionHandler(db);
    var voiceMessagesHandler = new VoiceMessagesHandler(db);

    router.get('/form', session.authenticatedUser, voiceMessagesHandler.sendTestForm); //TODO: use only for tests, remove on production;

    router.post('/send', session.authenticatedUser, multipartMiddleware, voiceMessagesHandler.sendMessage);
    router.get('/audio/:fileName', session.authenticatedUser, voiceMessagesHandler.getAudioFile);
    router.get('/answer/plivo', voiceMessagesHandler.answerPlivo);
    router.get('/answer/nexmo', voiceMessagesHandler.answerNexmo);

    return router;
};

