var express = require('express');
var router = express.Router();
var plivo = require( 'plivo-node' );
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );


module.exports = function(db) {
    /* GET users listing. */
    router.get( '/call', function ( req, res, next ) {
        var params = {};
        params.from = "+380967530189";
        params.to = "+380667778480";
        params.answer_url = "http://localhost:3000";
        p.make_call( params, function ( status, response ) {
            console.log( 'Status: ', status );
            console.log( 'API Response:\n', response );
            res.status( status ).send( response );
        } );

    } );
    return router;
};

