/**
 * Created by Roman on 10.02.2015.
 */
var plivo = require( 'plivo-node' );
var logWriter = require('../modules/logWriter')();
var async = require('async');
var lodash = require('lodash');
var util = require('util');
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );
var UserHandler = require('../handlers/users');


var Number = function (db) {
    var User = db.model('user');

    this.serchNumbers = function ( req, res, next ) {
        var countryIso = req.params.countryIso;
        countryIso = countryIso || 'US';
        countryIso = countryIso.toUpperCase();
        var params = {
            //type: 'mobile',
            services: 'sms',
            country_iso: countryIso
        };
        p.search_phone_numbers( params, function ( status, response ) {
            console.log( 'Status: ', status );
            console.log( 'API Response:\n', response );
            res.status( status ).send( response );
        } );
    };



    this.buyNumber = function ( req, res, next ) {
        var params = req.body;
        var packageName = params.packageName;
        var countryIso = params.countryIso || 'US';
        var number = params.number;
        var users = new UserHandler(db);
        var userId = (req.session) ? req.session.uId: null;
        /*var appId = options.app_id || "";
         var number = options.number;
         var params = {
         'app_id': appId,
         'number': number
         };*/
        params.app_id = parseInt(process.env.PLIVO_APP_ID) || 14672593026521222;
        // todo uncomment below lines for buying number through the PLIVO
       /* p.buy_phone_number( params, function ( status, response ) {

            var userId = (req.session) ? req.session.uId: null;
            var number;

            if(status === 201){
                number = (response.numbers) ? response.numbers[0].number : null;
                if(!userId || !number) {
                    var err = new Error( 'Incorrect Parameters' );
                    err.status = 400;
                    next( err );
                } else {
                    number = '+' + number;
                    users.addNumber( { userId: userId, number: number, countryIso: countryIso, packageName: packageName }, function(err, updatedUser){
                        if(err){
                            next(err);
                        } else {
                            var left = lodash.findWhere(resultUser.numbers, {number: number})['left'];
                            res.status(200).send({number: number, credits: resultUser.credits, left: left});
                        }
                    });
                }
            } else {
                res.status( status ).send( response );
            }
        } );*/
        number = '+' + number;
        users.addNumber({userId: userId, number: number, countryIso: countryIso, packageName: packageName}, function(err, resultUser){
            if (err){
                return next(err);
            }
            var left = lodash.findWhere(resultUser.numbers, {number: number})['left'];
            res.status(200).send({number: number, credits: resultUser.credits, left: left});
        });
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
                console.log('Numbers Unrented succefuly')
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