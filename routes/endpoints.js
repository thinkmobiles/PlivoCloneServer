/**
 * Created by Roman on 09.02.2015.
 */
var express = require('express');
var router = express.Router();
var plivo = require( 'plivo-node' );
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );

module.exports = function(db) {
    router.post( '/', function ( req, res, next ) {
        var options = req.body;
        var username = options.username;
        var password = options.password;
        var alias = options.alias;
        var app_id = options.app_id || "";

        var params = {
            'username': username,
            'password': password,
            'alias': alias,
            'app_id': ""
        };

        p.create_endpoint( params, function ( status, response ) {
            console.log( 'Status: ', status );
            console.log( 'API Response:\n', response );
            res.status( status ).send( response );
        } );
    } );

    return router;
};