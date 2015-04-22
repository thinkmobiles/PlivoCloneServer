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
                saveWinChannel( userId, channelURI, function( err ) {
                    if ( err ) {
                        return next( err );
                    }
                    res.status( 200 ).send('channel saved');
                } )
            } );
        }
    }

    this.sendPush = function( userId, header, msg, launch  ) {
        Push.find( { refUser: newObjectId( userId ) }, function(err, pushChannels ) {
            function sendPushWin( push ){
                wns.sendPush( push.channelURI, header, msg, launch, function () {} )
            }
            switch ( os ) {
                case 'WINDOWS': {
                    async.each( pushChannels, sendPushWin, function(){} )
                }
                    break;
                case 'GOOGLE': {
                    return;
                }
                    break;
                default: {
                    return;
                }
                    break
            }
        } );
    }
};

module.exports = Push;