/**
 * Created by Roman on 10.02.2015.
 */
var express = require( 'express' );
var router = express.Router();
var NumberHandler = require('../handlers/numbers');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var session = new SessionHandler(db);
    var numbers = new NumberHandler(db);

    router.get( '/search/:countryIso', /*session.authenticatedUser,*/ numbers.serchNumbers );
    //router.post( '/', session.authenticatedUser, numbers.byNumber );

    return router;
};