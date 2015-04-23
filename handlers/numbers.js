/**
 * Created by Roman on 10.02.2015.
 */
var plivo = require( 'plivo-node' );
var lodash = require('lodash');
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );
var UserHandler = require('../handlers/users');

var Number = function (db) {


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

                    users.addNumber( { userId: userId, number: number, countryIso: countryIso, packageName: packageName }, function(err, updatedUser){
                        if(err){
                            next(err);
                        } else {
                            res.status( 201 ).send( {success: "number " + number + "now is in your profile"} );
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
    }


};

module.exports = Number;