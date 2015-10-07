/**
 * Created by eriy on 02.06.2015.
 */
/*var Nexmo = require('simple-nexmo');*/
var Nexmo = require('./simple-nexmo');
var _ = require('lodash');
var nexmo = new Nexmo({
    apiKey:  process.env.NEXMO_API_KEY,
    apiSecret: process.env.NEXMO_API_SECRET,
     /*baseUrl: 'API_BASE_URL',
     useSSL: true,*/
     debug: process.env.NODE_ENV === 'development'
});

var outCallXmlRoute = process.env.HOST + '/control/nexmo/outbound';
var inCallXmlRoute = process.env.HOST + '/control/nexmo/inbound';
var NUMBER_TYPES = require('../constants/numberTypes');
var NUMBER_FEATURES = require('../constants/numberFeatures');

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
            var status = 0;
            var price = 0;
            var errMsg;
            var i;

            if ( err ) {
                err = new Error('NEXMO: ' + err.message);
                err.status = 400;

                return callback( err );
            }

            if ( ! response || ! response.messages ) {

                err = new Error('No response Data');
                err.status = 400;

                return callback( err );
            }

            if ( response.messages.length ) {
                for ( i = response.messages.length -1 ; i>=0; i-- ) {
                    if ( response.messages[i].status  !== '0' ) {
                        status = parseInt( response.messages[i].status );
                        errMsg = response.messages[i]['error-text'];
                        break;
                    }

                    price += parseFloat( response.messages[i]['message-price'] )
                }
            }

            if ( status  ) {
                err = new Error( errMsg );
                err.status = 400;

                return callback( err );
            }

            if ( process.env.NODE_ENV === 'development' ) {
                console.log(
                    '------------------------\n' +
                    'NEXMO OUTBUND MSG\n' +
                    'STATUS: ', response, '\nError: ', err
                );
            }

            callback(
                null,
                {
                    price: price,
                    count: parseInt(response['message-count']),
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
                    country: item.country,
                    provider: 'NEXMO'
                }
            });

            resultObj = {
                count: result.count,
                objects: numbers
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

    this.createCall = function ( params, callback ) {
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


        nexmo.voiceCall( options, function ( err, result ) {
            if (err) {
                return console.log( err );
            }

            console.log( result );
            /*callback( null, result )*/
        })
    };

    this.generatePlayXML = function (fileUrl) {
        var xmlString = /*'<?xml version="1.0" encoding="UTF-8"?>' +*/
                        '<vxml version = "2.1" >' +
                            '<form>' +
                                '<block>' +
                                    '<audio src="' + fileUrl + '"/>' +
                                '</block>' +
                            '</form>' +
                        '</vxml>';
                        console.log(xmlString);
        return xmlString;
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
