/**
 * Created by eriy on 02.06.2015.
 */
var plivo = require('plivo-node');
var api = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID || "MAYTRKODM5Y2ZINDVLOT",
    "authToken": process.env.PLIVO_AUTH_TOKEN ||"ZDNhZjZmYTZiZWU3NzJjNGZkOWYyMmY0YTA3ZGZk"
} );
var outCallXmlRoute = process.env.HOST || 'http://134.249.164.53:8830' + '/control/plivo/outbound/';


module.exports = function() {

    this.sendSmsMsg = function ( params, callback ) {
        var from = params.from;
        var to = params.to;
        var text = params.text;

        var options = {
            src: from,
            dst: to,
            text: text,
            type: 'sms'
        };

        api.send_message( options, callback );
    };

    this.searchNumber = function ( params, callback ) {
        var options;
        var country = params.countryIso || 'US';
        var page = params.page || 1;
        var limit = params.limit || 20;

        options = {
            country_iso: country,
            services: 'voice,sms',
            type: 'any',  //TODO DISCUSE
            limit: limit,
            offset: limit* ( page - 1 )
        };

        api.search_phone_numbers( options, callback );
    };

    this.buyNumber = function (  ) {

        api.buy_phone_number(  )
    };

    this.createCall = function ( params, callback  ) {
        var srcUserId = params.srcUser._id;
        var fileUrl = params.fileUrl;
        var src = params.src;
        var dst = params.dst;
        var answerUrl = outCallXmlRoute + '?file=' + fileUrl + '&uId=' + srcUserId.toString();
        console.log( JSON.stringify(answerUrl) );

        var callParams = {
            from: src,
            to: dst,
            answer_url: answerUrl
        };

        console.log( JSON.stringify(callParams) );

        api.make_call( callParams, function ( status, response ) {
            var err;

            if (status >= 200 && status < 300) {
                callback( null, response );
            } else {
                err = new Error();
                err.message = response.error || response.message;
                err.status = status;
                callback( err );
            }
        })
    };

};