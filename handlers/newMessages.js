/**
 * Created by eriy on 10.06.2015.
 */
var mongoose = require('mongoose');
var async = require('async');
var _ = require('lodash');

var Push = require('../handlers/push');
var PlivoHelper = require('../helpers/plivo');
var NexmoHelper = require('../helpers/nexmo');
var badRequests = require('../helpers/badRequests');
var plivo = new PlivoHelper;
var nexmo = new NexmoHelper;


var ObjectId = mongoose.Types.ObjectId;
var EXTERNAL_USER_ID = '123456789';
var PROVIDERS = require('../constants/providerTypes');

var providerRegExp = new RegExp('^'+ _.values(PROVIDERS).join('$|^') + '$', 'i' );

module.exports = function( app, db ) {
    /*DataBase models*/
    var AddressBook = db.model('addressbook');
    var Conversation = db.model('converstion');
    var Price = db.model('countries');
    var User = db.model('user');

    var push = new Push( db );

    var self = this;

    /*Private Functions*/
    function getUser( findCondition, projection, callback ) {

        User.findOne( findCondition, projection, callback )

    }

    function sendSocketMsg ( userId, data, callback ) {
        var io = app.get('io');

        io.sockets.to( userId ).emit('receiveMessage', data );

        callback();
    }


    /* Public Functions*/
    this.calculateChatString = function (src, dst) {
        var chat = '';

        if (src > dst) {
            chat = dst + ':' + src;
        } else {
            chat = src + ':' + dst;
        }

        return chat;
    };

    /* GET if Number is blocked by user
    *  In params:
    *       {
    *           dstUserId: <ObjectId>,
    *           number: <String>
    *       }
    *  Out: error 403 - blocked
    *       null - not blocked
    *       */
    this.checkBlockedNumbers = function (params, callback) {
        var criteria = {
            refUser: params.dstUserId,
            numbers: {
                $elemMatch: {
                    number: params.number,
                    isBlocked: true
                }
            }
        };
        var fields = {
            _id: true
        };

        AddressBook.findOne(criteria, fields, function (err, user) {
            var blockedErr;

            if (err) {

                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }

            } else if (user) {

                blockedErr = new Error('number is blacklisted by user');
                blockedErr.status = 403;

                if (callback && (typeof callback === 'function')) {
                    callback(blockedErr);
                }

            } else {

                if (callback && (typeof callback === 'function')) {
                    callback();
                }

            }
        });
    };

    /* GET price
     *  In params:
     *       {
     *           countryIso: <String[2]>,
     *           internal: <Boolean>,
     *           msgType: <String, VOICE || TEXT>
     *           service: <String, PLIVO || NEXMO>
     *       }
     *  Out: error 400 - Bad countryIso
     *       <Number Int> - Price
     *       */
    this.getPrice = function ( params, callback ) {
        var findCondition = {
            countryIso: params.countryIso
        };

        /*Country collection */
        Price.findOne( findCondition, function( err, result) {
            if (err) {
                return callback( err );
            }

            if ( ! result ) {
                err = new Error('Bad Country ISO');
                err.status = 400;

                return callback( err );
            }

            if ( params.internal  && (params.msgType  === 'TEXT') ) {
                return callback( null, parseInt( result.msgPriceInternal ) );
            }

            if ( params.internal  && params.msgType  === 'VOICE' ) {
                return callback( null, parseInt( result.msgPriceInternal ) );
            }

            if ( !params.internal  && params.msgType  === 'TEXT' ) {
                return callback( null, parseInt( result.msgPricePlivo ) );
            }

            if ( !params.internal  && params.msgType  === 'VOICE' ) {
                return callback( null, parseInt( result.msgPricePlivo ) );
            }

            callback( null, 0 );

        });
    };

    /* GET companions
     *  In params:
     *       {
     *           src: <String>,
     *           dst: <String>,
     *           userId: <String>
     *       }
     *  Out: error 400 - Bad srcUser
     *       {
     *            srcUser: results[0],
     *            dstUser: results[1],
     *            src: params.src,
     *           dst: params.dst,
     *           internal: <Boolean>
     *        }
     *       */
    this.getCompanions = function ( params, callback ) {
        var findSrcUser = {
            "numbers.number": params.src,
            _id: ObjectId( params.userId )
        };
        var findDstUser = {
            "numbers.number": params.dst
        };
        var projection = {
            numbers: true,
            enablepush: true,
            credits: true
        };

        var result = null;

        async.parallel(
            [
                async.apply( getUser, findSrcUser, projection ),
                async.apply( getUser, findDstUser, projection )
            ],
            function( err, results ) {
                if ( err ) {
                    return callback( err );
                }

                if ( ! results.length || ! results[0] ) {
                    err = new Error('Bad request');
                    err.status = 400;

                    return callback( err );
                }

                result = {
                    srcUser: results[0],
                    dstUser: results[1],
                    src: params.src,
                    internal: results[1] ? true : false,
                    dst: params.dst
                };

                callback( null, result );
            }
        );
    };

    this.creditWriteOff = function( userId, credits, callback ) {
        var updateCondition = {
            $inc: { credits: -parseInt( credits ) }
        };

        User.findByIdAndUpdate( userId, updateCondition, callback )
    };

    this.getPostOptions = function( params, callback ) {
        var userId = params.userId;
        var src = params.src;
        var dst = params.dst;
        var msgType = params.msgType;

        async.waterfall(
            [
                /*get Companions of numbers*/
                function( cb ) {
                   self.getCompanions( { src: src, dst: dst, userId: userId }, cb );
                },

                /* get price && check enough credits && get direction*/
                function( options, cb ) {
                    var numberObj = _.find( options.srcUser.numbers , function( item ) {
                        return item.number === options.src;
                    });
                    var countryIso = numberObj.countryIso;
                    var params = {
                        countryIso: countryIso,
                        internal: options.internal,
                        msgType: msgType
                    };

                    options.provider = numberObj.provider;

                    self.getPrice( params, function( err, result ) {
                        if ( err ) {
                            return cb( err );
                        }

                        options.price = parseInt( result );

                        if ( options.price > options.srcUser.credits ) {
                            /*err = new Error();
                            err.status = 402;*/
                            err = badRequests.NotEnCredits();

                            return cb( err );
                        }

                        cb( null, options);
                    });
                },

                /* check if blocked */
                function( options, cb) {
                    var findCondition = null;

                    if (! options.dstUser ) {
                        return cb( null, options )
                    }

                    findCondition = {
                        dstUserId: options.dstUser._id,
                        number: options.src
                    };

                    self.checkBlockedNumbers( findCondition, function( err ) {
                        if ( err ) {
                            return cb( err );
                        }

                        cb( null, options );
                    })
                },

                /* create conversation */
                function( options, cb ) {
                    var chat = self.calculateChatString( options.src, options.dst );
                    var srcUserId = options.srcUser._id.toString();
                    var dstUserId;
                    var companion;

                    var conversation = {
                        chat: chat,
                        owner: {
                            _id: srcUserId,
                            number: src
                        },
                        show: [srcUserId]
                    };

                    if ( options.dstUser ) {
                        dstUserId = options.dstUser._id.toString();
                        conversation.show.push( dstUserId );
                    } else {
                        dstUserId = EXTERNAL_USER_ID;
                    }

                    companion = {
                        _id: dstUserId,
                        number: dst
                    };
                    conversation.companion = companion;

                    options.conversation = conversation;

                    cb( null, options );
                }
            ],
            function( err, result ){
                if ( err ) {
                    return callback( err );
                }

                return callback( null, result );
            }
        )
    };


    this.sendInternalMessage = function( params, callback ) {
        var dstUserId = params.dstUserId;
        var src = params.src;
        var dst = params.dst;
        var pushEnabled = params.pushEnabled;
        var conversation = params.conversation;

        if ( process.env.NODE_ENV === 'development') {
            console.log(
                'Internal SMS:\n',
                'SRC: ', src, '\n',
                'DST: ', dst, '\n'
            );
        }

        async.parallel(
            [
                /* send MSG over socket*/
                function( cb ) {
                    sendSocketMsg( dstUserId, conversation, function(){}) ;
                    cb()
                },

                /* Send MSG over Push*/
                function( cb ) {
                    var pushParams = {
                        toUser: dstUserId,
                        src: src,
                        dst: dst,
                        msg: conversation.body
                    };

                    if ( pushEnabled ) {
                        push.sendPush( pushParams );
                    }

                    cb()
                }
            ],
            callback
        )
    };

    this.sendExternalTextMessage = function( params, callback  ) {
        var provider = params.provider;
        var msg = params.msg;
        var src = params.src;
        var dst = params.dst;

        var err;
        var sendFunc;
        var sendParams;

        if ( process.env.NODE_ENV === 'development') {
            console.log(
                'External SMS:\n',
                'Provider: ', provider, '\n',
                'SRC: ', src, '\n',
                'DST: ', dst, '\n'
            );
        }

        if ( ! providerRegExp.test(provider) ) {
            err = badRequests.InvalidValue( { value: provider, param: 'provider' } );
            err.status = 400;
            return callback( err );
        }

        switch ( provider ) {

            case 'PLIVO': {
                sendFunc = plivo.sendSmsMsg;
            } break;

            case 'NEXMO': {
                sendFunc = nexmo.sendSmsMsg;
            } break;

            default : {
                err = badRequests.InvalidValue( { value: provider, param: 'provider' } );
                err.status = 400;
                return callback()
            } break;
        }

        sendParams = {
            from: src,
            to: dst,
            text: msg
        };

        /*sendFunc( sendParams, callback );*/ //TODO uncoment for external
        callback( null );
    };

    this.sendTEXTMessage = function( params, callback ) {
        var userId = params.userId;
        var src = params.src;
        var dst = params.dst;
        var msg = params.msg;
        var msgType = 'TEXT';

        var sendParams;

        async.waterfall(
            [
                /* get options: src/dst User, price, direction*/
                function( cb ){
                    var options = {
                        userId: userId,
                        src: src,
                        dst: dst,
                        msgType: msgType
                    };

                    self.getPostOptions( options, cb );
                },

                /* add data to conversation && save */
                function( options, cb ) {
                    var conversation;

                    options.conversation.body = msg;

                    conversation = new Conversation( options.conversation );

                    options.conversation = conversation;

                    conversation.save( function( err ) {
                        if ( err ) {
                            return cb( err );
                        }

                        cb( null, options );
                    });
                },

                /* send MSG */
                function( options, cb ) {

                    if ( options.internal ) {
                        /* internal TEXT MSG*/
                        sendParams = {
                            dstUserId : options.conversation.companion._id,
                            src: options.src,
                            dst: options.dst,
                            msg: msg,
                            pushEnabled: options.dstUser.enablepush,
                            conversation: options.conversation
                        };

                        self.sendInternalMessage( sendParams, function( err ) {
                            if ( err ) {
                                return cb( err );
                            }

                            return cb( null, options );
                        })
                    } else {
                        /* external TEXT MSG */
                        sendParams = {
                            src: options.src,
                            dst: options.dst,
                            msg: msg,
                            provider: options.provider
                        };

                        self.sendExternalTextMessage( sendParams, function ( err, result) {
                            if ( err ) {
                                return cb ( err );
                            }

                            cb( null, options );
                        })
                    }
                },

                /* write OFF credits */
                function( options, cb ) {
                    var srcUserId = options.conversation.owner._id;
                    var price = options.price;

                    self.creditWriteOff( srcUserId, price, function( err, result  ){
                        if( err ) {
                            return cb( err );
                        }

                        options.srcUser.credits = result.credits;
                        cb( null, options )
                    })
                },

                /* get answer */
                function ( options, cb ) {
                    var response = {
                        success: "Message Sent",
                        credits: options.srcUser.credits,
                        message: options.conversation
                    };

                    delete options.conversation.show;

                    cb( null, response );
                }

            ],
            function( err, result ) {
                if ( err ) {
                    return callback( err )
                }

                callback( null, result );
            }
        )
    };

    this.sendMessage = function( req, res, next ) {
        var params = req.body;
        var options = {
            userId : req.session.uId,
            src: params.src,
            dst: params.dst,
            msg: params.text
        };

        self.sendTEXTMessage( options, function( err, result ) {
            if ( err ) {
                return next( err );
            }
            res.status( 200 ).send( result );
        })

    };

    this.getPlivoInboundSMS = function( req, res, next ) {
        var body = req.body;
        var from = '+' + body.From;
        var to = '+' + body.To;
        var msg = body.Text;

        /*TODO remove*/
        if ( process.env.NODE_ENV === 'development' ) {
            console.log(
                '------------------------\n' +
                'PLIVO INBOUND MSG\n' +
                'STATUS: START\n' +
                'BODY: ', body
            );
        }

        async.waterfall(
            [
                /* find user */
                function( cb ) {
                    var options = {
                        src: from,
                        dst: to,
                        msg: msg,
                        msgType: "TEXT" //TODO constant
                    };

                    var findDstUser = {
                        "numbers.number": to
                    };

                    getUser( findDstUser, {}, function( err, dstUser ) {
                        if ( err ) {
                            return cb( err );
                        }

                        if (! dstUser ) {
                            err = badRequests.InvalidValue( { param: 'dst', value: to } );
                            err = new Error('no user with ' + to + ' number');
                            err.status = 400;
                            return cb( err );
                        }

                        options.dstUser = dstUser;

                        cb( null, options );
                    } )
                },

                /* create conversation */
                function ( params, cb ) {
                    var dstUserId = params.dstUser._id.toString();
                    var chat = self.calculateChatString( params.src, params.dst );
                    var pushEnabled = params.dstUser.enablepush;
                    var conversation = {
                        owner: {
                            _id: EXTERNAL_USER_ID,
                            number: params.src
                        },
                        companion: {
                            _id: dstUserId,
                            number: params.dst
                        },
                        body: params.msg,
                        type: params.msgType,
                        show: [ dstUserId ],
                        chat: chat
                    };

                    conversation = new Conversation( conversation );

                    params.dstUserId = dstUserId;
                    params.pushEnabled = pushEnabled;

                    conversation.save( function(err, result ) {
                        if (err) {
                            return cb( err );
                        }

                        params.conversation = result;

                        cb( null, params );

                    });

                },

                /* send push & socket*/
                function( params, cb ) {
                    var dstUserId = params.dstUserId;
                    var src = params.src;
                    var dst = params.dst;
                    var pushEnabled = params.pushEnabled;
                    var conversation = params.conversation;

                    self.sendInternalMessage( params, function( err, result ) {
                        if ( err ) {
                            return cb( err );
                        }

                        cb( null, params)
                    });
                }
            ],
            function( err, result ) {
                if ( err ) {
                    return next( err );
                }

                /*TODO remove*/
                if ( process.env.NODE_ENV === 'development' ) {
                    console.log(
                        '------------------------\n' +
                        'PLIVO INBOUND MSG\n' +
                        'STATUS: SUCCESS'
                    );
                }

                res.status(200).send();
            }
        )
    };

    /*TEST routeHandlers*/
    this.test = function( req, res, next ) {
        var params = req.body;

        /*self.getPrice(params, function( err, price ) {
            var sRes = err || price;
            res.status( 200 ).send( JSON.stringify(sRes) );
        })*/

        /*params.dstUserId = ObjectId( params.dstUserId );
        self.checkBlockedNumbers( params, function( err, result ) {
            var sRes = err || result ;
            res.status( 200 ).send( JSON.stringify( sRes) );
        })*/

        /*self.getCompanions( params, function( err, result ) {
            var sRes = err || result ;
            res.status( 200 ).send( JSON.stringify( sRes) );
        })*/

        self.creditWriteOff( params.userId, params.price, function( err, result ) {
            var sRes = err || result ;
            res.status( 200 ).send( JSON.stringify( sRes) );
        } )
    };

    this.mainTest = function( req, res, next ) {
        var params = req.body;
        var userId = params.userId;
        var dst = params.dst;
        var src = params.src;
        var msgType = params.msgType;

        self.sendTEXTMessage( params, function( err, result ) {
            if ( err ) {
                return next( err );
            }
            res.status( 200 ).send( result );
        })

    }

};