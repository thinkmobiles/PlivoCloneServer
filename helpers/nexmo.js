/**
 * Created by eriy on 02.06.2015.
 */
/*var Nexmo = require('simple-nexmo');*/
var Nexmo = require('./simple-nexmo');
var _ = require('lodash');
var nexmo = new Nexmo({
    apiKey: '06e01628',
    apiSecret: '8d9c2526',
     /*baseUrl: 'API_BASE_URL',
     useSSL: true,*/
     debug: true //TODO: remove from production
});

var outCallXmlRoute = process.env.HOST + '/control/nexmo/outbound/';
var inCallXmlRoute = process.env.HOST + '/control/nexmo/inbound/';

module.exports = function () {

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
            from: from,
            to: to,
            type: 'text',
            text: text
        };

        nexmo.sendSMSMessage( options, function( err, response ) {
            if ( err ) {
                err = new Error('NEXMO: ' + err.message);
                err.status = 400;

                return callback( err );
            }

            if ( response && response.message ) {

                err = new Error('No response Data');
                err.status = 400;

                return callback(err);
            }

            if ( response.message.status != 0 ) {
                err = new Error( response.message.error-text );
                err.status = 400;

                return callback( err );
            }


            callback(
                null,
                {
                    price: response.message.message-price,
                    id: response.message.message-id,
                    service: 'NEXMO'
                }
            );
        });
    };

    this.searchNumber = function ( params, callback ) {
        var country = params.countryIso || 'US';
        var page = parseInt( params.page ) || 1;
        var limit = parseInt( params.limit ) || 20;

        var options = {
            country: country,
            features: 'SMS,VOICE',
            "index": page,
            size: limit
        };

        nexmo.searchNumbers( options, function ( err, result ) {
            var resultObj;
            var numbers;

            if ( err ) {
                return callback( err );
            }

            numbers = _.map( result.numbers, function ( item ) {
                return {
                    number: item.msisdn,
                    countryIso: item.country
                }
            });

            resultObj = {
                count: result.count,
                numbers: numbers
            };

            callback( null, resultObj);
        });
    };

    this.getNumberPriceByCountry = function ( params, callback ) {
        var country = params.countryIso;

        nexmo.getPricing(country, function (err, response) {
            var price;

            if (err) {
                return callback(err);
            }

            if (!response || (response.mt === undefined)) {
                err = new Error();
                err.message = '"mt" was not defined';
                err.status = 400;

                callback( err );
            } else {
                price = parseFloat(response.mt);
                callback(null, price);
            }
        });
    };

    this.buyNumber = function ( params, callback ) {
        /*params = {
            countryIso: <String[2], required>,
            number: <String, required>
        }*/

        var numberForBuy = params.number;
        var options = {
            country: params.countryIso,
            msisdn: params.number
        };

        nexmo.buyNumber( options, callback ); // TODO custom callback
    };

    this.sendVoiceMsg = function ( params, callback ) {
        var srcUserId = params.srcUser._id;
        var fileUrl = params.fileUrl;
        var src = params.src;
        var dst = params.dst;
        var answerUrl = outCallXmlRoute + '?file=' + fileUrl + '&uId=' + srcUserId.toString();

        var options = {
            from: src,
            to: dst,
            answer_url: answerUrl,
            answer_method: 'POST'
        };

        console.log(JSON.stringify(options));

        nexmo.voiceCall( options, function ( err, result ) {
            if (err) {
                return console.log( err );
            }

            console.log( result );
        })
    };

    this.generatePlayXML = function (fileUrl) {
        var xmlString = '';
    };

    this.generateRecordXML = function (from, to) {
        var xmlString =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<vxml version = "2.1" >' +
                '<var name="callerid" expr="TO_BE_SET_BY_THE_SCRIPT" />' +
                '<form>' +
                    '<record name="recording" beep="true" dtmfterm="true" maxtime="100s">' +
                        '<filled>' +
                            '<submit next=' + inCallXmlRoute + ' method="post" namelist="recording callerid" enctype="multipart/form-data"/>' +
                        '</filled>' +
                    '</record>' +
                '</form>' +
            '</vxml>';
    };
};
