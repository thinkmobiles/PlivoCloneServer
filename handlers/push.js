/**
 * Created by eriy on 21.04.2015.
 */
var UserHandler = require('../handlers/users');
var mongoose = require('mongoose');
var newObjectId = mongoose.Types.ObjectId;
var Wns = require('../helpers/wns');
var async = require('async');
var path = require('path');
var _ = require('lodash');
var wns = new Wns;
var gcm = require('../helpers/gcm')('AIzaSyCon4JAMBlXEonuzKYLCO5PbOW3PjH_biU');
var apn = require('../helpers/apns')(path.join("config/PseudoAPNSDev.p12"));

var PUSH_OPERATORS = require('../constants/pushOperators');
var operatorRegExp = new RegExp('^'+ _.values(PUSH_OPERATORS).join('$|^') + '$' );

var Push = function (db) {
    var self = this;
    var User = db.model( 'user' );
    var Push = db.model('push');

    //todo add unique index for channel exept null
    function saveChannel( userId, channel, provider, callback ) {
        var createObj = {
            provider: provider,
            channelURI: channel,
            refUser: newObjectId( userId )
        };

        var push = new Push( createObj );
        push.save( callback );

    }


    this.newChannel = function( req, res, next ) {
        /* {
            channelURI:
            provider: 'WINDOWS'
        } */
        var userId = req.session.uId;
        var provider = req.body.provider;
        var channelURI = req.body.channelId;

        if ( !channelURI ||! provider ) {
            return res.status( 400 ).send( { error: 'Bad request' } );
        }

        if ( channelURI && provider ) {
            User.findOne( {_id: userId, enablepush: true }, function( err, resUser ){
                if ( err ) {
                    return next( err );
                }

                if ( !resUser ) {
                    err = new Error('push notification is forbidden');
                    err.status = 403;
                    return next( err )
                }

                if (! operatorRegExp.test( provider ) ) {
                    return res.status( 500 ).send( { error: 'not implemented' } );
                }

                saveChannel( userId, channelURI, 'WINDOWS', function( err ) {
                    if ( err && err.code !== 11000 ) {
                        err = new Error('channel exist');
                        err.status = 409;
                        return next( err );
                    }
                    res.status( 200 ).send('channel saved');
                } );


            } );
        }
    };

    /*this.sendPush = function( userId, header, dstNumber, msg, launch  ) {*/
    this.sendPush = function( params ) {

        /*var pushParams = {
            toUser: sendToUserId,
            src: params.src,
            dst: params.dst,
            msg: body
        };*/
        var userId = params.toUser;
        var src = params.src;
        var dst = params.dst;
        var msg = params.msg;


        Push.find( { refUser: newObjectId( userId )  }, function( err, pushChannels ) {

            function sendOnePush( onePush, callback ){

                if ( !onePush || !onePush.provider || !onePush.channelURI ) {
                    err = new Error('bad push record');
                    return callback( err );
                }

                switch ( onePush.provider ) {
                    case 'WINDOWS': {

                        wns.sendPush( onePush.channelURI, src, msg, JSON.stringify( { dst: dst, src: src } ), function (err) {
                            if ( err  && ( (err === 410) || (err === 404) ) ) {
                                onePush.remove( function( err, result ){
                                    if ( err ) {
                                        return console.log( err.message );
                                    }
                                })
                            }
                        } );
                    }
                        break;

                    case 'GOOGLE': {
                        gcm.sendPush( onePush.channelURI, msg, { from: src, to: dst }, function ( err, result) {
                            if ( err ) {
                                /*TODO remove*/
                                return console.log( err.message );
                            }
                            console.log( result );
                        });
                        /*return;*/
                    }
                        break;

                    case 'APPLE': {
                        apn.sendPush( onePush.channelURI, msg, { payload: { from: src, to: dst } }, function ( err, result) {
                            if ( err ) {
                                /*TODO remove*/
                                return console.log( err.message );
                            }
                            console.log( result );
                        });
                        /*return;*/
                    }
                        break;

                    default: {
                        return;
                    }
                        break;
                }
            }

            async.each( pushChannels, sendOnePush, function( err, result ){

            });

        } );
    };

    this.sendTestPush = function ( req, res, next ) {
        self.sendPush( "5538ad3663e4d9634200000c", '+300000000000', 'Test From Backend \nPlease contact me in skype.  Alexandr Roman. \n Чесно.', JSON.stringify({ src: '+300000000000', dst:  "+16133191044" }) );
        res.status(200).send('OK');
    }
};

module.exports = Push;