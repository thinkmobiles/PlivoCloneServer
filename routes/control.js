/**
 * Created by eriy on 03.06.2015.
 */
var express = require( 'express' );
var plivo = require('plivo-node');
var router = express.Router();

module.exports = function (db) {
    var response1 = '<Response><Speak loop="2" voice="WOMAN">Welcom. This is a response from answer URL. Have a nice day</Speak></Response>'

    router.post( '/plivo/inbound', function( req, res, next ) {
        var response = plivo.Response();
        var body = req.body;

        response.addRecord({
            action: 'http://134.249.164.53:8830/control/plivo/result/' + body.From + '/' + body.To,
            method: 'POST',
            fileFormat: 'mp3',
            maxLength: 10,
            playBeep: true,
            recordSession: true
        });

        /*TODO test and remove*/
        console.log('Plivo inCall request:');
        console.log( JSON.stringify(body) );

        res.status(200).send( response );
    });

    router.post('/plivo/result/:from/:to', function ( req, res, next ) {
        var from = req.params.from;
        var to = req.params.to;

        console.log('Plivo inbound result:\n' + 'From: ' + from + '\n' + 'To: ' + to);
        console.log( JSON.stringify( body ) );

        res.status(200).send();
    });

    router.post( '/plivo/outbound', function( req, res, next ) {
        var response = plivo.Response();
        var body = req.body;

        response.addPlay('https://s3.amazonaws.com/plivocloud/Trumpet.mp3');

        console.log('Request to answer:\n');
        console.log( JSON.stringify(body) );

        res.status(200).send( response );
    });


    router.post( '/plivo/hangup', function( req, res, next ) {
        var body = req.body;
        console.log('Request to hangUp:\n');
        console.log( JSON.stringify(body) );

        res.status(200).send();
    });

    return router;
};