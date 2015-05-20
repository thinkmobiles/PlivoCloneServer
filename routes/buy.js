/**
 * Created by eriy on 21.04.2015.
 */
var express = require( 'express' );
var router = express.Router();
var Buy = require('../handlers/buy');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var session = new SessionHandler(db);
    var buy = new Buy(db);

    router.post( '/', session.authenticatedUser, buy.buy );
    //router.get('/', buy.createContryPrices ); // todo remove
    //router.post( '/', session.authenticatedUser, numbers.byNumber );

    return router;
};