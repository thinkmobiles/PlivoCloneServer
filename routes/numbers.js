/**
 * Created by Roman on 10.02.2015.
 */
var express = require( 'express' );
var router = express.Router();
var NumberHandler = require('../handlers/numbers');
var UsersHandler = require('../handlers/users');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var session = new SessionHandler(db);
    var numbers = new NumberHandler(db);
    var users = new UsersHandler(db);
    router.get( '/search/:countryIso', /*session.authenticatedUser,*/ numbers.serchNumbers );
    router.post('/buy', session.authenticatedUser, numbers.buyNumber);
    router.post('/extend', session.authenticatedUser, users.extendNumber);
    //router.post( '/', session.authenticatedUser, numbers.byNumber );

    return router;
};