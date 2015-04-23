/**
 * Created by eriy on 14.04.2015.
 */
var express = require( 'express' );
var router = express.Router();
var PriceHandler = require('../handlers/price');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var session = new SessionHandler(db);
    var prices = new PriceHandler(db);

    router.get( '/countries', session.authenticatedUser, prices.getCountriesPrice );
    /*router.post('/countries', session.authenticatedUser, prices.addCountriesPrice);
    router.delete('/countries', session.authenticatedUser, prices.deleteCountriesPrice);*/

    return router;
};