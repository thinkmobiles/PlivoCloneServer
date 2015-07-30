/**
 * Created by eriy on 21.04.2015.
 */
var UserHandler = require('../handlers/users');
var mongoose = require('mongoose');
var async = require('async');
var ObjectId = mongoose.Types.ObjectId;
var iap = require('../helpers/in-app-purchase');
var xml = require('xml2js');
var path = require('path');

iap.config({
    applePassword: "c8f948446a0b4f1e94107ac48d4ad6fa",
    googlePublicKeyPath: path.join( __dirname, '..', 'config')
});

var Buy = function (db) {
    var BuyHistory = db.model( 'buyHistory' );
    var Country = db.model('countries');
    var BuyPackage = db.model('buyPackage');
    var User = db.model('user');

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
                sellerType = iap.GOOGLE;
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