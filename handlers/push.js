/**
 * Created by eriy on 21.04.2015.
 */
var UserHandler = require('../handlers/users');
var mongoose = require('mongoose');
var newObjectId = mongoose.Types.ObjectId;
var Wns = require('../helpers/wns');
var async = require('async');
var wns = new Wns;

var Push = function (db) {
    var self = this;
    var User = db.model( 'user' );
    var Push = db.model('push');

    //todo add unique index for channel exept null
    function saveWinChannel( userId, channel, callback ) {
        var createObj = {
            provider: 'WINDOWS',
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

                switch ( provider ) {
                    case 'WINDOWS': {
                        saveWinChannel( userId, channelURI, function( err ) {
                            if ( err && err.code !== 11000 ) {
                                err = new Error('channel exist');
                                err.status = 409;
                                return next( err );
                            }
                            res.status( 200 ).send('channel saved');
                        } );
                    }
                        break;

                    case 'GOOGLE': {

                        res.status( 500 ).send('not implemented');
                    }
                        break;

                    default: {
                        res.status( 500 ).send('not implemented');
                    }
                        break;
                }

                /*saveWinChannel( userId, channelURI, function( err ) {
                    if ( err && err.code !== 11000 ) {
                        err = new Error('channel exist');
                        err.status = 409;
                        return next( err );
                    }
                    res.status( 200 ).send('channel saved');
                } );*/

            } );
        }
    };

    this.sendPush = function( userId, header, msg, launch  ) {

        Push.find( { refUser: newObjectId( userId )  }, function( err, pushChannels ) {

            function sendOnePush( onePush, callback ){

                if ( !onePush || !onePush.provider || !onePush.channelURI ) {
                    err = new Error('bad push record');
                    return callback( err );
                }

                switch ( onePush.provider ) {
                    case 'WINDOWS': {

                        wns.sendPush( onePush.channelURI, header, msg, launch, function (err) {
                            if ( err  && ( (err === 410) || (err === 404) ) ) {
                                onePush.remove( function( err, result ){
                                    if ( err ) {
                                        //return callback( err );
                                        return callback(null);
                                    }
                                })
                            }
                        } );
                    }
                        break;

                    case 'GOOGLE': {
                        return;
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