/**
 * Created by eriy on 21.04.2015.
 */
var UserHandler = require('../handlers/users');
var mongoose = require('mongoose');
var async = require('async');
var ObjectId = mongoose.Types.ObjectId;
var iap = require('../helpers/in-app-purchase');
var xml = require('xml2js');

iap.config({
    applePassword: "c8f948446a0b4f1e94107ac48d4ad6fa"
});

var Buy = function (db) {
    var BuyHistory = db.model( 'buyHistory' );
    var Country = db.model('countries');
    var BuyPackage = db.model('buyPackage');
    var User = db.model('user');

    //todo remove test receip
/*
    var receipt1 =
        '<?xml version="1.0"?><Receipt Version="1.0" ReceiptDate="2012-08-30T23:08:52Z" CertificateId="b809e47cd0110a4db043b3f73e83acd917fe1336" ReceiptDeviceId="4e362949-acc3-fe3a-e71b-89893eb4f528">' +
    '<ProductReceipt Id="6bbf4366-6fb2-8be8-7947-92fd5f683530" ProductId="Product1" PurchaseDate="2012-08-30T23:08:52Z" ExpirationDate="2012-09-02T23:08:49Z" ProductType="Durable" AppId="55428GreenlakeApps.CurrentAppSimulatorEventTest_z7q3q7z11crfr" />' +
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<SignedInfo>' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />' +
    '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />' +
    '<Reference URI="">' +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />' +
    '<DigestValue>Uvi8jkTYd3HtpMmAMpOm94fLeqmcQ2KCrV1XmSuY1xI=</DigestValue>' +
    '</Reference>' +
    '</SignedInfo>' +
    '<SignatureValue>TT5fDET1X9nBk9/yKEJAjVASKjall3gw8u9N5Uizx4/Le9RtJtv+E9XSMjrOXK/TDicidIPLBjTbcZylYZdGPkMvAIc3/1mdLMZYJc+EXG9IsE9L74LmJ0OqGH5WjGK/UexAXxVBWDtBbDI2JLOaBevYsyy+4hLOcTXDSUA4tXwPa2Bi+BRoUTdYE2mFW7ytOJNEs3jTiHrCK6JRvTyU9lGkNDMNx9loIr+mRks+BSf70KxPtE9XCpCvXyWa/Q1JaIyZI7llCH45Dn4SKFn6L/JBw8G8xSTrZ3sBYBKOnUDbSCfc8ucQX97EyivSPURvTyImmjpsXDm2LBaEgAMADg==</SignatureValue>' +
    '</Signature>' +
    '</Receipt>';

    var receipt1000 =
        '<Receipt Version="2.0" CertificateId="A656B9B1B3AA509EEA30222E6D5E7DBDA9822DCD" xmlns="http://schemas.microsoft.com/windows/2012/store/receipt">' +
            '<ProductReceipt PurchasePrice="₴0" PurchaseDate="2015-04-21T15:58:03.817Z" Id="6da52613-97cb-4602-bbc6-8478fcdb124a" AppId="TechnativesPtyLtd.Pseudo.beta_kdgrb65xkrdnm" ProductId="thouthand" ProductType="Consumable" PublisherUserId="RNDyVBukABp5Edb7/8/yc094ZSzzOukVbECkyJ7scQc=" PublisherDeviceId="jxi8lw0OZxq/7R44uy+axDBzegiSLH/A3KO09BBYRqU=" MicrosoftProductId="8a1f08a5-6ae8-47b9-9e40-a5dd03892986" MicrosoftAppId="a399e6c0-aa53-457b-bf4d-c90d6c594664" />' +
            '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
                '<SignedInfo>' +
                    '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />' +
                    '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />' +
                    '<Reference URI="">' +
                    '<Transforms>' +
                        '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />' +
                    '</Transforms>' +
                    '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />' +
                    '<DigestValue>ybxlR64ez0KFoND1OIptUcgf0jBWNqU+8m6hUHmjCY8=</DigestValue>' +
                    '</Reference>' +
                '</SignedInfo>' +
                '<SignatureValue>jeoQA5t5UDviD3Pkv3Xf6k3KL37SK01g3jFzNkgZHrTFZxO6LlfBY2uz8rghjCQjibnFN8w4BiiPojdO6I2tYkdcKO7Wy3PxeyKqHYIWk5MaClkdo0qHQPMC/CXhtoJs0Br5UoeqciQf85mO61bQh04/eWJOX70MDXbapOb2jZim7tbZagZKqDYIHEWS7nYc5G9ObdhZUD5XIotqLFTtpwCzg6ISdsRdo4MmxumjDp/I6Vl4oicd98slH1Q03jaIS1+fvschu9QQ6BEM3spf/iHTPGKyvWk4/n+ABrOA+GG7+xPggXCVotd269uRSJ7gjn/o/1Y8/asoH2xQFKf2XA==</SignatureValue>' +
            '</Signature>' +
        '</Receipt>';
*/


    function parseWindowsReceipt(receipt, callback){
        var unParseObj;
        var parser = xml.parseString;
        var findOptions;

        parser(receipt, function( err, parsedXML ){
            if (err){
                return callback(err);
            }

            // todo Object check for existing keys
            unParseObj = {
                appId: parsedXML.Receipt.ProductReceipt[0].$.AppId,
                productId: parsedXML.Receipt.ProductReceipt[0].$.ProductId,
                receiptId: parsedXML.Receipt.ProductReceipt[0].$.Id
            };

            findOptions = {
                "productId.windows": unParseObj.productId,
                "appId.windows": unParseObj.appId
            };

            callback(null, unParseObj);
        });
    }

    function checkReceipt( receipt, seller, callback ) {
        var sellerType;
        var err;

        switch (seller ) {
            case 'WINDOWS': {
                sellerType = iap.WINDOWS;
            }
                break;

            case 'GOOGLE': {
                err = new Error('not implemented');
                err.status = 400;
                return callback( err );
            }
                break;

            case 'APPLE': {
                sellerType = iap.APPLE;
            }
                break;

            default: {
                err = new Error('not implemented');
                err.status = 400;
                return callback( err );
            }
                break;
        }

        iap.setup( function ( err ) {
            if ( err ) {
                return callback( err )
            }
            iap.validate( sellerType, receipt, function( err, receiptRes ) {
                if ( err ) {
                    return callback( err );
                }

                if ( iap.isValidated( receiptRes ) ) {
                    return callback( null, iap.getPurchaseData( receiptRes ) );
                }

                err = new Error('not valid');
                err.status = 400;
                callback( err );
            });
        });
    }

    //todo make return true false
    function isUsed( receiptId, callback ) {
        var findCond = {
            receiptId: receiptId
        };
        BuyHistory.findOne( findCond ).exec( function( err, receipt ) { //todo make collection
            if ( err ) {
                return callback( err );
            }
            if ( receipt ) {
                err = new Error('receipt is used');
                err.status = 400;

                return callback( err );
            }
            callback( null );
        } )
    }

    function addCredits( userId, credits, callback ) {
        var updateCondition = {
            $inc: {
                credits: credits
            }
        };
        User.findByIdAndUpdate( userId, updateCondition, { new: true }, callback );
    }

    function getPackageCredits( appId, os, productId, callback ) {
        var findCondition;
        var err;

        switch ( os ) {
            case 'WINDOWS': {
                findCondition = {
                    "productId.windows": productId,
                    "appId.windows": appId
                };
            }
                break;
            case 'GOOGLE': {
                findCondition = {
                    "productId.google": productId,
                    "appId.google": appId
                };
            }
                break;
            case 'APPLE': {
                findCondition = {
                    "productId.apple": productId,
                    "appId.apple": appId
                };
            }
                break;
            default: {
                err = new Error('platform not supported');
                err.status = 404;
                return callback( err );
            }
                break
        }

        BuyPackage.findOne( findCondition, function( err, curPackage ) {
            if ( err ) {
                return callback( err );
            }
            if ( !curPackage ) {
                err = new Error('package not found');
                err.status = 404;
                return callback ( err );
            }
            callback( null, curPackage.credits )
        })
    }


    function saveBuyToHistory( params, callback ){
        /*var options = {
            appId,
            productId,
            receiptId,
            os,
            rawReceipt,
            isValidated
        }*/
        var modelData = {
            receiptId: params.receiptId,
            productId: params.productId,
            appId: params.appId,
            os: params.os,
            rawReceipt: params.rawReceipt,
            refUser: params.refUser
        };

        if ( params.isValidated ) {
            modelData.isValidated = params.isValidated;
        }

        var buyRecord = new BuyHistory( modelData );

        buyRecord.save( callback );

    }

    this.buy = function( req, res, next ) {
        var userId = req.session.uId;
        var receipt = req.body.receipt;
        var os = req.body.provider || 'WINDOWS'; //TODO remove or

        //receipt = receipt1000;
        var err;

        if ( ! receipt ) {
            err = new Error('invalid parameters');
            err.status = 400;
            return next( err )
        }

        switch ( os ) {
            case 'WINDOWS': {
                receipt = receipt.replace('<?xml version="1.0"?>',"");
            }
                break;
            case 'GOOGLE': {
                // TODO change !!
                return addCredits( userId, 2000, function (err, updatedUser ) {
                    if (err) {
                        return next( err );
                    }
                    res.status(200).send({ credits: updatedUser.credits })
                })
            }
                break;
            case 'APPLE': {

            }
                break;
            default: {
                err = new Error('platform not supported');
                err.status = 400;
                return next( err );
            }
                break;
        }

        /*validateReceipt( receipt, os, function( err, response ){
            var appId;
            var productId;

            if (err) {
                //return res.status(500).send(err.message);
                return next(err);
            }
            appId = response[0].appId;
            productId = response[0].productId;*/

            async.waterfall(
                [
                    function( cb ) {
                        checkReceipt( receipt, os, function( err, validatedReceipt ) {
                            var saveOptions;

                            if ( err ) {
                                return cb( err, saveOptions );
                            }

                            saveOptions = {
                                appId: validatedReceipt[0].appId,
                                productId: validatedReceipt[0].productId,
                                receiptId: validatedReceipt[0].receiptId,
                                os: os,
                                isValidated: true,
                                refUser: ObjectId( userId ),
                                rawReceipt: receipt
                            };

                            console.log('Receipt Options: ', saveOptions );
                            cb( null, saveOptions );
                        });
                    },

                    function( saveOptions, cb ) {
                        var receiptId = saveOptions.receiptId;

                        isUsed( receiptId, function( err, result ) {
                            if ( err ) {
                                return cb( err );
                            }

                            cb( null, saveOptions );
                        })
                    },

                    /* get package credit amount*/
                    function( saveOptions, cb ) {
                        var appId = saveOptions.appId;
                        var productId = saveOptions.productId;

                        getPackageCredits( appId, os, productId, function( err, credits ) {

                            if ( err ) {
                                return cb( err );
                            }

                            saveOptions.credits = credits;

                            cb( null, saveOptions );
                        });
                    },

                    /* add credit amount to account*/
                    function( saveOptions, cb ) {
                        var credits = saveOptions.credits;

                        addCredits( userId, credits, function( err, updatedUser ) {
                            if ( err ) {
                                return cb( err );
                            }

                            saveOptions.user = updatedUser;
                            cb( null, saveOptions );

                        });
                    },

                    function( saveOptions, cb ) {
                        saveBuyToHistory( saveOptions, function( err ) {
                            if ( err ) {
                                return cb( err );
                            }

                            cb( null, saveOptions );
                        })
                    }

                ],

                /* waterfall main callback */
                function( err, saveoptions ) {
                    if ( err ) {
                        return next( err );
                    }

                    res.status( 200).send(
                        {
                            credits: saveoptions.user.credits
                        }
                    )
                }
            );

            /*getPackageCredits( appId, os, productId, function( err, credits ) {
                if ( err ) {
                    return next( err );
                }

                addCredits( userId, credits, function (err, updatedUser ) {
                    if (err) {
                        return next( err );
                    }

                    res.status(200).send(
                        {
                            credits: updatedUser.credits
                        }
                    )
                })

            } )
        })*/
    };

/*    this.createContryPrices = function (req, res, next ) {
        var insObj0 = {
            name: 'Unaited State',
            countryIso : 'US',
            setUpFee: 104,
            msgPriceInternal: 0,
            msgPricePlivo: 0,
            buyNumberPackages: [
                {
                    price: 221,
                    packageName: 'One Month',
                    packageDuration: 1
                },
                {
                    price: 338,
                    packageName: 'Two Months',
                    packageDuration: 2
                }
            ],
            extendNumberPackages:[
                {
                    price: 221,
                    packageName: 'One Month',
                    packageDuration: 1
                },
                {
                    price: 338,
                    packageName: 'Two Months',
                    packageDuration: 2
                }
            ],
            ourCharge: 100,
            store: 30,
            monthlyFeeTotal: 80
        };
        var insObj1 = {
            name: 'Australia',
            countryIso : 'AU',
            setUpFee: 455,
            msgPriceInternal: 0,
            msgPricePlivo: 0,
            buyNumberPackages: [
                {
                    price: 923,
                    packageName: 'One Month',
                    packageDuration: 1
                },
                {
                    price: 1391,
                    packageName: 'Two Months',
                    packageDuration: 2
                }
            ],
            extendNumberPackages:[
                {
                    price: 360,
                    packageName: 'One Month',
                    packageDuration: 1
                },
                {
                    price: 720,
                    packageName: 'Two Months',
                    packageDuration: 2
                }
            ],
            ourCharge: 100,
            store: 30,
            monthlyFeeTotal: 80
        }

        var country = new Country(insObj1);
        country.save(function(err){
            if (err) {
                //return res.status(500).send(err.message);
                return next(err);
            }
            res.status(200).send(country);
        })

    }*/

};

module.exports = Buy;