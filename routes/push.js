/**
 * Created by eriy on 21.04.2015.
 */
var express = require( 'express' );
var router = express.Router();
var Push = require('../handlers/push');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var session = new SessionHandler(db);
    var push = new Push(db);

    router.post( '/channel', session.authenticatedUser, push.newChannel );
    router.get('/test', push.sendTestPush);
    return router;
};