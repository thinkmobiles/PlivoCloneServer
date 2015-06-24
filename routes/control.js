/**
 * Created by eriy on 03.06.2015.
 */
var express = require('express');
var router = express.Router();
//var SessionHandler = require('../handlers/sessions');
var VoiceMessagesHandler = require('../handlers/voiceMessages');
var NexmoHelper = require('../helpers/nexmo');
var nexmoHelper =  new NexmoHelper;

module.exports = function ( app, db ) {
    //var session = new SessionHandler(db);
    var voiceMessagesHandler = new VoiceMessagesHandler( app, db );


    router.post('/plivo/inbound', voiceMessagesHandler.inboundPlivo); //answer_url
    router.post('/plivo/result',voiceMessagesHandler.plivoRecordCallback);
    router.post('/plivo/outbound', voiceMessagesHandler.answerPlivo);
    router.post('/plivo/hangup', voiceMessagesHandler.plivoHangup);

    /*nexmo routes*/
    router.post('/nexmo/outbound', voiceMessagesHandler.answerNexmo);

    return router;
};