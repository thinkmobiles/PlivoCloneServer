/**
 * Created by eriy on 21.04.2015.
 */
var UserHandler = require('../handlers/users');

var Push = function (db) {
    this.newChannel = function( req, res, next ) {
        var channelId = req.body.channelId;
        if ( channelId ) {
            res.status(200).send('channel saved');
        }
    }
};

module.exports = Push;