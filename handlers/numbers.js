/**
 * Created by Roman on 10.02.2015.
 */
var plivo = require( 'plivo-node' );
var logWriter = require('../modules/logWriter')();
var async = require('async');
var lodash = require('lodash');
var _ = require('lodash');
var util = require('util');
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );
var UserHandler = require('../handlers/users');
var PlivoHandler = require('../helpers/plivo');
var NexmoHandler = require('../helpers/nexmo');
var badRequests = require('../helpers/badRequests');
var Nexmo = new NexmoHandler;
var Plivo = new PlivoHandler;



var Number = function (db) {
    var User = db.model('user');
    var Country = db.model('countries');

    var isPhoneNumber  = /^\+?[0-9]$/i;

    this.serchNumbers = function ( req, res, next ) {
        var params = {
            countryIso: ( req.params.countryIso || 'US' ).toUpperCase(),
            page: req.query.p,
            limit: req.query.l
        };
        var provider = 'PLIVO';
        var resultObj;

        switch ( provider ) {
            case 'PLIVO': {
                Plivo.searchNumber( params, function( err, result ) {
                    if ( err ) {
                        return next( err );
                    }
                    resultObj = _.map( result.objects, function( item ) {
                        return {
                            number: item.number,
                            country: item.country,
                            provider: 'PLIVO'
                        }
                    });

                    return res.status( 200).send( { objects: resultObj } );
                });
            } break;
            case 'NEXMO': {
                Nexmo.searchNumber( params, function( err, result ){
                    if ( err ) {
                        return next( err );
                    }

                    return res.status( 200).send( result );
                })
            } break;
            default: {} break;
        }
    };

    this.newBuyNumber = function( params, mainCallback ) {
        var countryIso = params.countryIso;
        var packageName = params.packageName;
        var userId = params.userId;

        /* Get country prices & options*/
        function getCountryOptions( countryIso, callback ) {
            Country.findOne(
                {
                    countryIso: countryIso.toUpperCase()
                },
                function( err, countryOptions ) {
                    if ( err ) {
                        return callback( err );
                    }

                    if ( ! countryOptions ) {
                        return callback( badRequests.NotFound({ message: 'Country: ' + countryIso + 'not supported' }) );
                    }

                    callback( null, countryOptions );
                }
            )
        }

        async.parallel(
            {
                numberOptions: function( cb ) {
                    getCountryOptions( countryIso, function( err, countryOptions ) {
                        if ( err ) {
                            return cb( err );
                        }

                        var number;

                        number = _.find( countryOptions.buyNumberPackages, { packageName: packageName });

                        if (! number ) {
                            return cb( badRequests.NotFound({ message: 'Package: ' + packageName + 'not found' }) );
                        }

                        cb( null, number );
                    })
                },

                userModel: function( cb ) {
                    User
                        .findOne(
                            { _id: ObjectId( userId ) },
                            { numbers: true , credits: true }
                        ).
                        exec( function( err, user) {
                            if ( err ) {
                                return cb( err );
                            }

                            if (! user ) {

                            }
                        })
                }
            },
            function( err, results ) {
                if ( err ) {
                    return mainCallback( err );
                }


            }
        )


    };

    this.buyNumber = function ( req, res, next ) {
        var params = req.body;
        var packageName = params.packageName;
        var countryIso = params.countryIso || 'US';
        var provider = params.provider || 'PLIVO'; //TODO remove constant -> add validation
        var number = params.number;
        var users = new UserHandler(db);
        var userId = req.session.uId;
        var err;
        var buyFunc;
        var buyParams;

        if ( !packageName || !countryIso || ! provider || ! number ) {
            err = badRequests.NotEnParams();
            err.status = 400;
            return next( err )
        }

        number =  number.replace(/[^0-9]/g, '');

        buyParams = {
            number: number,
            countryIso: countryIso
        };

        switch ( provider ) {
            case 'PLIVO': {
                buyFunc = Plivo.buyNumber;
            } break;
            case 'NEXMO': {
                buyFunc = Nexmo.buyNumber;
            } break;
            default: {} break;
        }

        buyFunc( buyParams, function( err ) {
            if ( err ) {
                return next( err );
            }

            if ( !(/^\+/i).test(number) ) {
                number = '+' + 'number';
            }

            return users.addNumber(
                {
                    userId: userId,
                    number: number,
                    countryIso: countryIso,
                    packageName: packageName,
                    provider: provider

                },
                function(err, resultUser){
                    if (err){
                        return next( err );
                    }
                    var left = lodash.findWhere(resultUser.numbers, {number: number})['left'];
                    res.status(200).send(
                        {
                            number: number,
                            credits: resultUser.credits,
                            left: left
                        }
                    );
                });
        });


        /*number = '+' + number;
        users.addNumber(
            {
                userId: userId,
                number: number,
                countryIso: countryIso,
                packageName: packageName,
                provider: provider

            },
            function(err, resultUser){
                if (err && (err.code === 11000) ){
                    err = new Error('Number '+ number +' is in use. Please select another');
                    return next(err);
                }

                if (err ){
                    return next(err);
                }
                var left = lodash.findWhere(resultUser.numbers, {number: number})['left'];
                res.status(200).send(
                    {
                        number: number,
                        credits: resultUser.credits,
                        left: left
                    }
                );
        });*/
    };

    function deleteExpiredNumbers( now, userModel, callback ){
        var i;
        var length = 0;
        var numbersNew;
        if ( userModel.numbers && util.isArray(userModel.numbers) ) {
            length = userModel.numbers.length;
        }
        numbersNew = lodash.remove(userModel.numbers, function( number ){
            var isOld =  number.expire > now;
            if ( !isOld ) {
                /*p.unrent_number(removeNumber, function(err){
                    if (err){
                        return callback(err);
                    }
                });*/
                logWriter.log('Number ' + number.number + ' is unrented')
            }
            return isOld;
        });
        userModel.numbers = numbersNew;
        userModel.save( callback );
    }

    this.deleteUnrentNumbers = function(){
        var now = new Date();
        var findCond = {
            "numbers.expire": { $lt: now }
        };


        User.find( findCond ).exec( function(err, users){
            async.eachLimit( users, 3, async.apply( deleteExpiredNumbers, now ), function( err, results ){ //TODO set limit constant and
                if ( err ) {
                    return console.log( err.message );
                    //logWriter.log('Number ', err.message + '\n' + err.stack);
                }
                console.log('Numbers Unrented succefuly');
            })
        })
    };

    /*this.deleteUnrentNumbers = function() {

        var removeNumber;
        var date = new Date();

        User.find(function (err, cursor) {
            if (err) {
                return logWriter.log('', err.message + '\n' + err.stack);
            }
            cursor.forEach(function (findedUser) {

                var saveUser = findedUser;
                var findResult = findedUser.toJSON();
                var updatedUser = findResult.numbers;

                async.each(findResult.numbers, function (number, callback) {

                    if (number.expire < date) {
                        removeNumber = {
                            number: number.number
                        };
                        // todo uncomment lines below for running delete number through the PLIVO and insert deleting from database in callback
                        *//*p.unrent_number(removeNumber, function(err){
                             if (err){
                             return callback(err);
                             }
                         });*//*

                        updatedUser = lodash.dropWhile(updatedUser, removeNumber);
                        //console.log(updatedUser);
                    }
                    callback(null);

                }, function (err) {
                    if (err) {
                        return logWriter.log('', err.message + '\n' + err.stack);
                    }

                    saveUser.numbers = updatedUser;
                    console.log(saveUser.numbers);
                    saveUser.save(function (err) {
                        if (err) {
                            return logWriter.log('', err.message + '\n' + err.stack);
                        }
                        logWriter.log(); //todo informative log
                    });
                });
            });
        });
    };*/
};

module.exports = Number;