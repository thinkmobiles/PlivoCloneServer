
var NumberHandler = require('./numbers');
var VoiceMessagesHandler = require('./voiceMessages');
var Schedule = function (db){
    var numbers = new NumberHandler(db);
    var voiceMessages = new VoiceMessagesHandler(db);

    var cron = require('cron');
    var cronString = '0 23 * * *';

    this.cronJob = cron.job(cronString, numbers.deleteUnrentNumbers);
    this.deleteOldMessagesJob = cron.job(cronString, voiceMessages.deleteOldMessages);
};

module.exports = Schedule;