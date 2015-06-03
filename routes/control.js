/**
 * Created by eriy on 03.06.2015.
 */
var express = require( 'express' );
var router = express.Router();

module.exports = function (db) {
    var response1 = '<Response><Speak loop="2" voice="WOMAN">Welcom. This is a response from answer URL. Have a nice day</Speak></Response>'


    router.post( '/plivo/inCall', function( req, res, next ) {
        var body = req.body;
        console.log( JSON.stringify(body) );

        res.status(200).send( response1 );
    });

    return router;
};