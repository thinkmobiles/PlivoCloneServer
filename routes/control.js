/**
 * Created by eriy on 03.06.2015.
 */
var express = require('express');
var router = express.Router();
//var SessionHandler = require('../handlers/sessions');
var VoiceMessagesHandler = require('../handlers/voiceMessages');

module.exports = function (db) {
    //var session = new SessionHandler(db);
    var voiceMessagesHandler = new VoiceMessagesHandler(db);

    router.post('/plivo/inbound', voiceMessagesHandler.inboundPlivo);
    router.post('/plivo/result',voiceMessagesHandler.plivoRecordCallback);
    router.post('/plivo/outbound', voiceMessagesHandler.answerPlivo);
    router.post('/plivo/hangup', voiceMessagesHandler.plivoHangup);

    return router;
};