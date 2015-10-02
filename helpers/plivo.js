/**
 * Created by eriy on 02.06.2015.
 */
var plivo = require('plivo-node');
var api = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID || "MAYTRKODM5Y2ZINDVLOT",
    "authToken": process.env.PLIVO_AUTH_TOKEN ||"ZDNhZjZmYTZiZWU3NzJjNGZkOWYyMmY0YTA3ZGZk"
} );
var outCallXmlRoute = process.env.HOST + '/control/plivo/outbound/';
var NUMBER_TYPES = require('../constants/numberTypes');
var NUMBER_FEATURES = require('../constants/numberFeatures');
var PLIVO_APP_ID = process.env.PLIVO_APP_ID || 14672593026521222;

module.exports = function() {

    this.sendSmsMsg = function ( params, callback ) {
        /*params = {
         from: <from number>,
         to: <to number>,
         text: <msg text>
         };*/

        var from = params.from;
        var to = params.to;
        var text = params.text;

        var options = {
            src: from,
            dst: to,
            text: text,
            type: 'sms'
        };

        api.send_message( options, function ( status, response ) {
            var err;

            if (status >= 200 && status < 300) {
                callback( null, response );
            } else {
                err = new Error();
                err.message = /*response.error || response.message*/'Plivo send SMS Error';
                console.log('Error:Plivo:SendSMS:status-', status, ':response-', response);
                err.status = status;
                callback( err );
            }
        } );
    };

    this.searchNumber = function ( params, callback ) {
        var options;
        var country = params.countryIso || 'US';
        var type = params.type || NUMBER_TYPES.LOCAL;  //TODO DISCUSE;
        var services = params.feature || NUMBER_FEATURES.SMS_AND_VOICE;  //TODO DISCUSE;
        var page = params.page || 1;
        var limit = params.limit || 20;

        if (country) {
            country = country.toUpperCase();
        }

        options = {
            country_iso: country,
            services: services,
            type: type,
            limit: limit,
            offset: limit* ( page - 1 )
        };

        api.search_phone_numbers( options, function ( status, response ) {
            var err;

            if (status >= 200 && status < 300) {
                callback( null, response );
            } else {
                err = new Error();
                err.message = response.error || response.message;
                err.status = status;
                callback( err );
            }
        } );
    };

    this.getNumberPriceByCountry = function ( params, callback ) {
        var country = params.countryIso;
        var type = params.type || NUMBER_TYPES.LOCAL;
        var options = {
            country_iso: country
        };

        api.get_pricing(options, function (status, response) {
            var err;
            var price;

            if (status >= 200 && status < 300) {

                if (response && response.phone_numbers && (response.phone_numbers[type] !== undefined)) {
                    price = response.phone_numbers[type]['rate'];
                    price = parseFloat(price);

                    callback( null, price );
                } else {
                    err = new Error();
                    err.message = 'Invalid type "' + type +'"';
                    err.status = 400;

                    callback( err );
                }

            } else {
                err = new Error();
                err.message = response.error || response.message;
                err.status = status;
                callback( err );
            }
        } );
    };

    this.buyNumber = function ( params, callback ) {
        /*params = {
            number: '+380667777777',
            app_id: ""
        };*/
        var options = {
            number: params.number
        };


        options.app_id = params.app_id || PLIVO_APP_ID;


        api.buy_phone_number( options , function ( status, response ) {
            var err;

            if (status >= 200 && status < 300) {
                callback( null, response );
            } else {
                err = new Error();
                err.message = response.error || response.message;
                err.status = status;
                callback( err );
            }
        } )
    };

    this.createCall = function ( params, callback  ) {
        var srcUserId = params.srcUser._id;
        var fileUrl = params.fileUrl;
        var src = params.src;
        var dst = params.dst;
        var answerUrl = outCallXmlRoute + '?file=' + fileUrl + '&uId=' + srcUserId.toString();

        /*TODO test and remove*/
        console.log( JSON.stringify(answerUrl) );

        var callParams = {
            from: src,
            to: dst,
            answer_url: answerUrl
        };

        /*TODO test and remove*/
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

    this.generatePlayXML = function (fileUrl) {
        var response = plivo.Response();

        response.addPlay(fileUrl);

        return response.toXML();
    };

    this.generateRecordXML = function () {
        var response = plivo.Response();

        response.addRecord({
            action: process.env.HOST + '/control/plivo/result',
            method: 'POST',
            fileFormat: 'mp3',
            maxLength: 10,
            playBeep: true,
            recordSession: true
        });

        return response.toXML();
    };

};