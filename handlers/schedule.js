
var NumberHandler = require('./numbers');
var Schedule = function (db){
    var numbers = new NumberHandler(db);
    var cron = require('cron');
    var cronString = '*/1 * * * *';

    this.cronJob = cron.job(cronString, numbers.deleteUnrentNumbers);
};

module.exports = Schedule;