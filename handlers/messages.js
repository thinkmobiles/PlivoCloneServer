var plivo = require( 'plivo-node' );
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );
var async = require( 'async' );
var lodash = require( 'lodash' );
var util = require('util');
var SocketConnectionHandler = require( '../handlers/socketConnections' );

var Message = function ( db, app ) {
    var mongoose = require( 'mongoose' );
    var Conversation = db.model( 'converstion' );
    var AddressBook = db.model('addressbook');
    var Price = db.model('countries');
    var UserHandler = require( '../handlers/users' );
    var Push = require('../handlers/push');
    var newObjectId = mongoose.Types.ObjectId;
    var socketConnection = new SocketConnectionHandler( db );
    var push = new Push( db );


    function lastConvObjects( options, callback ) {
        var matchId = options.matchId || null;
        var groupType = options.groupType || 'companion';
        var match;
        var groupString;
        var matchObject;
        var sortObject;
        var groupObject;
        var projectionObject;
        var matchString = (groupType === 'owner') ? "owner" : "companion";

        matchString += "._id";
        match = {};
        match[matchString] = matchId;
        groupString = "$companion.number";

        matchObject = {
            $match: match
        };

        sortObject = {
            $sort: {
                "postedDate": -1
            }
        };

        groupObject = {
            $group: {
                _id: groupString,
                conversation: {
                    $first: "$$ROOT"
                }
            }
        };
        projectionObject = {
            $project: {
                "conversation": 1
            }
        };

        Conversation.aggregate( [matchObject, sortObject, groupObject, projectionObject] ).exec( callback );
    }

    function getConversationsByType( type, options, callback ) {
        var query;
        var projectionObject;
        var numbers;
        var optionsObject;
        var limit = options.limit || 50;
        var userId = options.userId;
        var dstNumber = ( options.numbers ) ? options.numbers[0] : null;
        var srcNumber = ( options.numbers ) ? options.numbers[1] : null;

        if( type === 'userId' ) {
            query = {
                $or: [
                    {"owner._id": userId},
                    {"companion._id": userId}
                ]
            };
        } else {
            query = {
                $or: [
                    {
                        "owner.number": srcNumber,
                        "companion.number": dstNumber
                    },
                    {
                        "owner.number": dstNumber,
                        "companion.number": srcNumber
                    }
                ]
            };
        }

        projectionObject = {
            _id: 0
        };

        optionsObject = {
            sort: {postedDate: -1}
        };

        Conversation
            .find( query, projectionObject , optionsObject)
            .limit( limit )
            .exec( callback );
    }

    function subCredits(userObject, isInternal, src, callback){
        var msgPrice;
        var userObj;
        var countryIso;
        var err;
        var number;

        if ( !(userObject && util.isArray(userObject.numbers) && userObject.numbers.length )  ) {
            err = new Error('empty user ');
            err.status = 500;
            return callback(err);
        }



        userObj = userObject.toJSON();
        number = lodash.findWhere(userObj.numbers, {number: src});

        if (!number ) {
            err = new Error('bad source number');
            err.status = 500;
            return callback(err);
        }

        countryIso = number['countryIso'];
        countryIso = countryIso.toUpperCase();

        Price.findOne({countryIso: countryIso}, function(err, res){
            if (err){
                return callback(err);
            }
            if (res && res.msgPriceInternal !== undefined && res.msgPricePlivo !== undefined ){
                msgPrice = (isInternal) ? (res.msgPriceInternal) : (res.msgPricePlivo);

                if (userObject.credits < msgPrice){
                    err = new Error('Have no credits');
                    err.status = 400;
                    return callback(err);
                }
                userObject.credits -= msgPrice;

                userObject.save( function(err){
                    if ( err ){
                        return callback(err);
                    }
                    callback( null, userObject.credits );

                });
            } else {
                err = new Error('no price record');
                err.status = 404;
                callback( err );
            }
        });
    }

    this.subCredits = subCredits;

    this.sendMessage = function ( req, res, next ) {
        /* var params = {
         'src': '15702217824',
         'dst': '380667778480',
         'text': "ghgjkhgghg jklhbl hlkh",
         'type': "sms"
         };*/
        var users = new UserHandler( db );
        var params = req.body;
        var body = params.text;
        var dst = params.dst;
        var src = params.src;
        var userId = req.session.uId;
        var findBlocked;
        var socketId;
        var sendToUserId;
        var sConObject;
        var companion;
        var conversation;
        var destSocket;
        var plivoParams;
        var chat;
        var dstId = '123456789';
        var io = (app) ? app.get( 'io' ) : null;
        var isInternal;
        /*p.send_message( params, function ( status, response ) {
         console.log( 'Status: ', status );
         console.log( 'API Response:\n', response );
         res.status( 200 ).send( response );
         } );*/

        socketConnection.findSocket( dst, function ( err, response ) {
            if( err ) {
                next( err );
            } else {
                users.findUserById( userId, function ( err, userObject ) {

                    if( err ) {
                        next( err );
                    } else  if ( response ) {
                        isInternal = true;
                        sConObject = response.socketConnection;
                        companion = response.companion;
                        //socketId = sConObject.socketId;
                        sendToUserId = companion._id;
                        conversation = new Conversation();
                        conversation.body = body;

                        findBlocked = {
                            refUser: sendToUserId,
                            numbers : {
                                $elemMatch: {
                                    number: src,
                                    isBlocked: true
                                }
                            }
                        };

                        var projectionOpt = {
                            _id: true
                        };


                         AddressBook.findOne( findBlocked, projectionOpt, function ( err, user ) {
                            if ( err ) {
                                return next(err);
                            }
                            if ( user ) {

                                err = new Error('number is blacklisted by user');
                                err.status = 403;

                                return res.status( err.status ).send( { success: err.message } );
                            } else {

                                if ( params.src > params.dst ) {
                                    chat = params.dst + ':' + params.src;
                                } else {
                                    chat = params.src + ':' + params.dst;
                                }

                                conversation.chat = chat;
                                conversation.owner = {
                                    _id: userId,
                                    name: {
                                        first: userObject.name.first,
                                        last: userObject.name.last
                                    },
                                    number: params.src
                                };
                                conversation.companion = {
                                    _id: sendToUserId,
                                    name: {
                                        first: companion.name.first,
                                        last: companion.name.last
                                    },
                                    number: params.dst
                                };
                                conversation.body = body;
                                conversation.show = [userId, sendToUserId];
                                conversation.save(function (err, savedResponse) {
                                    if (err) {
                                        next(err)
                                    } else {
                                        subCredits(userObject, isInternal, src, function(err, updatedCredits){
                                            var launchMsg = {
                                                src: params.src,
                                                dst: params.dst
                                            };
                                            if (err){
                                                return next(err);
                                            }
                                            if (io) {
                                                async.each(sConObject.socketId, function(socketId, callback){
                                                    destSocket = io.sockets.connected[socketId];
                                                    if (destSocket){
                                                        destSocket.emit('receiveMessage', savedResponse);
                                                        callback(null);
                                                    } else {
                                                        /*err = new Error('Destination socket not found');
                                                        err.status = 404;
                                                        callback(err);*/
                                                        callback(null)
                                                    }
                                                }, function(err){
                                                    if (err){
                                                        return next(err);
                                                    }
                                                });
                                                /*destSocket = io.sockets.connected[socketId];
                                                if (destSocket) {
                                                    destSocket.emit('receiveMessage', savedResponse);
                                                }*/
                                            }
                                            // todo move status check to sendPush
                                            if ( companion &&  companion.enablepush ) {
                                                push.sendPush( sendToUserId.toString(), params.src, conversation.body, JSON.stringify( launchMsg ));
                                            };

                                            res.status(201).send({credits: updatedCredits});
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        if (params.src && params.dst && params.text) {
                            isInternal = false;
                            conversation = new Conversation();
                            if (params.src > params.dst){
                                chat = params.dst + ':' + params.src;
                            } else {
                                chat = params.src + ':' + params.dst;
                            }
                            conversation.chat = chat;
                            conversation.owner = {
                                _id: userId,
                                name: {
                                    first: userObject.name.first,
                                    last: userObject.name.last
                                },
                                number: params.src
                            };

                            // TODO conversation.companion _id

                            conversation.companion = {
                                _id: dstId,
                                name: {
                                    first: "Anonymous",
                                    last: "Anonymous"
                                },
                                number: params.dst
                            };
                            conversation.body = body;
                            conversation.show = [userId, dstId];
                            plivoParams = {
                                src: params.src,
                                dst: params.dst,
                                text: params.text,
                                type: "sms"
                            };

                            subCredits(userObject, isInternal, src, function(err, updatedCredits){
                                if (err){
                                    return next(err);
                                }
                                //TODO uncoment plivo
                                /*p.send_message( params, function ( status, response ) {
                                    conversation.save(function(err){
                                        if (err){
                                            next(err);
                                        } else {
                                            res.status( 200 ).send( {credits: updatedCredits} );
                                        }
                                    });
                                });*/
                                res.status( 200 ).send( {credits: updatedCredits} );
                            });


                        } else {
                            err = new Error('Bad request');
                            err.status = 400;
                            next(err);
                        }
                    }
                } );
            }
        } );
    };

    this.messageInfo = function ( req, res, next ) {
        var messageUuid = req.param( 'message_uuid' );
        var params = {
            record_id: messageUuid
        };
        /*  p.get_message( params, function ( status, response ) {
         console.log( 'Status: ', status );
         console.log( 'API Response:\n', response );
         res.status( 200 ).send( response );
         } );*/
    };

    this.postMessage = function ( req, res, next ) {
        var message = req.body;
        console.dir( message );

        res.status( 200 ).send();
    };


    this.getConversations = function ( req, res, next ) {
        var userId = req.session.uId;
        var srcNumber = req.params.src;
        var dstNumber = req.params.dst;
        var limit = parseInt(req.query.l) || 20;
        var page = parseInt(req.query.p) || 1;
        var skip = (page -1) * limit;
        var chat;
        var findObj;
        var projObj;
        var sortObj;

        if ( srcNumber > dstNumber ) {
            chat = dstNumber + ':' + srcNumber;
        } else {
            chat = srcNumber + ':' + dstNumber;
        }

        findObj = {
            $or: [
                {"owner._id": userId},
                {"companion._id": userId}
            ],
            chat: chat,
            show: {$in: [ userId ]}
        };
        projObj = {
            chat: 0,
            show: 0,
            "__v": 0
        };
        sortObj = {
            postedDate: -1
        };

        Conversation
            .find( findObj, projObj )
            .sort( sortObj )
            .skip( skip )
            .limit( limit )
            .exec( function ( err, docs ) {
                if ( err ) {
                    return next(err);
                }
                res.status( 200 ).send( docs );
            })
    };

    this.getLastByChats = function ( req, res, next) {
        var userId = req.session.uId;
        var limit = parseInt(req.query.l) || 20;
        var page = parseInt(req.query.p) || 1;
        var skip = (page -1) * limit;

        Conversation.aggregate([
            {
                $match:{
                    $or:[
                        { "companion._id": userId },
                        {"owner._id": userId }
                    ],
                    show: {
                        $in: [userId]
                    }
                }
            },
            {
                $sort: { postedDate: -1 }
            },
            {
                $project: {
                    body: 1,
                    chat: 1,
                    owner: 1,
                    companion: 1,
                    postedDate: 1
                }
            },
            {
                $group:{
                    _id: "$chat",
                    lastmessage: {
                        $first:"$$ROOT"
                    }
                }
            },
            {
                $sort: { "lastmessage.postedDate": -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ], function ( err, docs ) {

            if ( err ) {
                return next( err );
            }

            res.status( 200 ).send( docs );
        })

    };

    this.getRecentCompanion = function (req, res, next){
        var userId = req.session.uId;
        var addressBookEntries;
        var numbers;
        var recent = [];
        var sortedRecent;
        var lastRecent;
        var sortObj = {
            'postedDate': -1
        };
        var projectObj = {
            'show': 0
        };

        AddressBook.find({refUser : newObjectId( userId )})
            .exec(function(err, entries){
                if (err){
                    next(err);
                }
                addressBookEntries = entries;

                async.each(addressBookEntries, function(element, callback){
                    numbers = lodash.pluck(element.numbers, 'number');
                    Conversation.aggregate([
                        {
                            $match: {
                                $and: [
                                    {
                                        show: {
                                            $in: [ userId ]
                                        }
                                    },
                                    {
                                        $or: [
                                            {"owner._id": userId},
                                            {"companion._id": userId}
                                        ]
                                    },
                                    {
                                        $or: [
                                            {"owner.number": {$in : numbers}},
                                            {"companion.number": {$in : numbers}}
                                        ]
                                    }
                                ]
                            }
                        },
                        {
                         $project: {
                             'body': 1,
                             'companion': 1,
                             'postedDate': 1,
                             'owner': 1
                         }
                        },
                        {
                            $sort: sortObj
                        },
                        {
                            $limit: 1
                        }
                    ], function(err, doc){
                        if (err){
                            return callback(err)
                        }
                        if (doc.length){
                            recent.push(doc[0]);
                        }
                        callback();
                    });
                }, function(err){
                    if (err){
                        return next(err);
                    }
                    sortedRecent = lodash.sortByOrder(recent, 'postedDate', false);
                    lastRecent = sortedRecent.slice(0, 5);

                    res.status(200).send(lastRecent);
                });
            });
    };

    this.deleteChat = function(req, res, next){
        var number1 = req.params.n1;
        var number2 = req.params.n2;
        var userId = req.session.uId;

        var chat = (number1 < number2) ? (number1 + ':' + number2) : (number2 + ':' + number1);

        Conversation.update({chat: chat}, {$pull: {show: userId}}, {multi: true}, function(err){
            if (err){
                return next(err);
            }
            res.status(200).send({success: "Chat deleted successfully"});
        });
    };


    /* get unread msg count for chat*/
    this.getUnReadCount = function( req, res, next ) {
        var userId = req.session.uId;
        var num1 = req.params.num1;
        var num2 = req.params.num2;
        var chat ;

        if ( num1 > num2 ) {
            chat = num2 + ':' + num1;
        } else {
            chat = num1 + ':' + num2;
        }

        Conversation
            .find({
                chat: chat,
                "companion._id": userId,
                show: {
                    $in: [ userId ]
                },
                read: false
            })
            .count()
            .exec( function( err, unreadCount ) {
                if ( err ) {
                    return next( err );
                }

                res.status( 200 ).send({ success: 'unread count', chat: chat, count: unreadCount })
            })
    };

    /* set messages as read
    *  PUT
    *  {
    *       read: [ _id ]
    *  }
    *  */
    this.setRead = function( req, res, next ) {
        var userId = req.session.uId;
        var body = req.body;
        var readMsgs = body.read;

        Conversation
            .update(
            {
                "companion._id": userId,
                _id: { $in: readMsgs }
            },
            {
                $set: { read: true }
            },
            { multi: true }
            ).exec( function( err, result) {
                if ( err ) {
                    return next( err );
                }

                res.status(201).send({success: 'massage is read'})
            })
    };
};

module.exports = Message;