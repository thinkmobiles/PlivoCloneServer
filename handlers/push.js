'use strict';

/**
 * Created by eriy on 21.04.2015.
 */

var WNS_CLIENT_ID = 'ms-app://s-1-15-2-2329854933-3467371773-235525189-2707151496-3265958890-3459980472-2316457019';
var WNS_CLIENT_SECRET = 'c4JJzw7O3W5ugNwayTWbsxVR7bp6XZy5';

//var UserHandler = require('../handlers/users');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
//var Wns = require('../helpers/wns');
var WNS = require('../helpers/wns');
var async = require('async');
var path = require('path');
var _ = require('lodash');
//var wns = new Wns;
var gcm = require('../helpers/gcm')('AIzaSyCon4JAMBlXEonuzKYLCO5PbOW3PjH_biU');
var apn = require('../helpers/apns')(path.join("config/PseudoAPNSDev.p12"));
var wns = new WNS(WNS_CLIENT_ID, WNS_CLIENT_SECRET);

var PUSH_OPERATORS = require('../constants/pushOperators');
var providerRegExp = new RegExp('^' + _.values(PUSH_OPERATORS).join('$|^') + '$');
var badRequests = require('../helpers/badRequests');

var Push = function (db) {
    var self = this;
    //var User = db.model('user');
    var PushModel = db.model('push');

    function sendPushMessages(pushModels, params, callback) {
        var src = params.src;
        var dst = params.dst;
        var msg = params.msg;
        var inactiveIds = [];

        function sendOnePush(pushModel, cb) {
            var err;
            var pushOptions;
            var provider;

            if (!pushModel || !pushModel.provider || !pushModel.channelURI) {
                err = new Error('bad push record');
                return cb(err);
            }

            switch (pushModel.provider) {
                case 'WINDOWS':
                {
                    pushOptions = {
                        launch: JSON.stringify({dst: dst, src: src}),
                        header: src
                    };
                    provider = wns;
                }
                    break;

                case 'GOOGLE':
                {
                    pushOptions = {
                        from: src,
                        to: dst
                    };
                    provider = gcm;
                }
                    break;

                case 'APPLE':
                {
                    pushOptions = {
                        payload: {
                            from: src,
                            to: dst
                        }
                    };
                    provider = apn;
                }
                    break;

                default:
                {
                    err = badRequests.NotFound({message: 'Not found valid provider to sending push notifications'});
                    return console.error(err);
                }
                    break;
            }

            provider.sendPush(pushModel.channelURI, msg, pushOptions, function (err, sendResult) {
                cb();

                if (err) {
                    if ((err.statusCode === 410)
                        || (err.statusCode === 404)
                        || (err && err.message.indexOf('ENOTFOUND') !== -1)
                    ) {
                        inactiveIds.push(pushModel._id);
                    }

                    if (process.env.NODE_ENV !== 'production') {
                        console.log('>>> An error has occurred on sending push: ', err);
                    }
                } else {
                    /*if (process.env.NODE_ENV !== 'production') {
                     console.log('>>> push was send success: ', sendResult);
                     }*/
                }
            });

        }

        async.each(pushModels, sendOnePush, function (err) {
            var result = {
                total: pushModels.length,
                inactiveIds: inactiveIds
            };

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                if (callback && (typeof callback === 'function')) {
                    callback(null, result);
                }
            }
        });
    };

    this.removeInactiveModels = function (ids, callback) {
        var criteria = {
            _id: {
                $in: ids
            }
        };

        PushModel.remove(criteria, function (err, result) {
            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                if (callback && (typeof callback === 'function')) {
                    callback(null, result);
                }
            }
        });
    };

    this.newChannel = function (req, res, next) {
        /* {
         channelURI:
         provider: 'WINDOWS'
         } */

        var userId = req.session.uId;
        var params = req.body;
        var provider = params.provider;
        var deviceId = params.deviceId;
        var channelURI = params.channelId;
        var criteria;
        var update;

        if (!channelURI || !provider) {
            return next(badRequests.NotEnParams({reqParams: ['channelId', 'provider']}));
        }

        if (!providerRegExp.test(provider)) {
            return next(badRequests.InvalidValue({message: 'Incorrect provider: ' + provider}));
        }

        switch ( provider ) {
            case 'WINDOWS': {
                if ( !deviceId ) {
                    return next(badRequests.NotEnParams({reqParams: ['deviceId']}));
                }
            } break;
            case 'APPLE': {
                deviceId = channelURI
            } break;
            case 'GOOGLE': {
                if ( !deviceId ) {
                    return next(badRequests.NotEnParams({reqParams: ['deviceId']}));
                }
            } break;
            default: {} break;
        }

        /*criteria = {
            channelURI: channelURI
        };*/

        criteria = {
            deviceId: deviceId
        };

        update = {
            $set: {
                channelURI: channelURI,
                provider: provider,
                refUser: ObjectId(userId),
                updatedAt: new Date()
            }
        };

        PushModel.findOneAndUpdate(criteria, update, {upsert: true}, function (err, result) {
            if (err) {
                return next(err);
            }
            res.status(200).send({success: 'channel saved'});
        });
    };

    this.sendPush = function (params) {
        /*var pushParams = {
         toUser: sendToUserId,
         src: params.src,
         dst: params.dst,
         msg: body
         };*/
        var userId = params.toUser;

        async.waterfall([

            //try to find channels by user:
            function (cb) {
                PushModel.find({refUser: ObjectId(userId)}, function (err, pushModels) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, pushModels);
                });
            },

            //try to send messages:
            function (pushModels, cb) {
                sendPushMessages(pushModels, params, function (err, result) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, result);
                });
            },

            //remove inactive pushModels:
            function (result, cb) {
                var inactiveIds;

                cb(null, result);

                if (result && result.inactiveIds && result.inactiveIds.length) {

                    inactiveIds = result.inactiveIds;

                    self.removeInactiveModels(inactiveIds, function (err) {
                        if (err) {
                            if (process.env.NODE_ENV !== 'production') {
                                console.error('>>> Try to remove inactive push: ', err);
                            }
                        } else {
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('>>> Success removed ' + inactiveIds.length + ' inactive push');
                            }
                        }
                    });
                }
            }

        ], function (err, result) {
            if (err) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error(err);
                }
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('>>> Total messages: ', result.total);
                    console.log('>>> Inactive was found: ', result.inactiveIds.length);
                }
            }
        });
    };

    this.sendTestPush = function (req, res, next) {
        var params = req.query;
        var pushParams = {
            toUser: params.dst || "5538ad3663e4d9634200000c",
            src: "+300000000000",
            dst: "+16133191044",
            msg: "Test From Backend \nPlease contact me in skype.  Alexandr Roman. \n Чесно."
        };

        self.sendPush(pushParams);
        res.status(200).send('OK');
    }
};

module.exports = Push;