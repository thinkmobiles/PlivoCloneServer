var plivo = require( 'plivo-node' );
var p = plivo.RestAPI( {
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
} );
var async = require( 'async' );
var lodash = require( 'lodash' );
var SocketConnectionHandler = require( '../handlers/socketConnections' );

var Message = function ( db, app ) {
    var mongoose = require( 'mongoose' );
    var Conversation = db.model( 'converstion' );
    var AddressBook = db.model('addressbook');
    var UserHandler = require( '../handlers/users' );
    var newObjectId = mongoose.Types.ObjectId;
    var socketConnection = new SocketConnectionHandler( db );

    /*function lastConvObjects( options, callback ) {
        var matchId = options.matchId || null;
        var groupType = options.groupType || 'companion';
        var match;
        var groupString;
        var matchObject;
        var sortObject;
        var groupObject;
        var projectionObject;
        var matchString = (groupType === 'companion') ? "owner" : "companion";

        matchString += "._id";
        match = {};
        match[matchString] = matchId;
        groupString = "$" + groupType + "._id";

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
        //Conversation.aggregate( [matchObject, groupObject, sortObject, projectionObject] ).exec( callback );
    }*/

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
        var io = (app) ? app.get( 'io' ) : null;
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
                    } else  if (response) {
                        sConObject = response.socketConnection;
                        companion = response.companion;
                        socketId = sConObject.socketId;
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
                                conversation.save(function (err, savedResponse) {
                                    if (err) {
                                        next(err)
                                    } else {
                                        if (io) {
                                            destSocket = io.sockets.connected[socketId];
                                            if (destSocket) {
                                                destSocket.emit('receiveMessage', savedResponse);
                                            }
                                        }
                                        res.status(201).send({success: 'Message Posted'});
                                    }
                                });
                            }
                        });
                    } else {
                        if (params.src && params.dst && params.text) {
                            plivoParams = {
                                src: params.src,
                                dst: params.dst,
                                text: params.text,
                                type: "sms"
                            };
                            p.send_message( params, function ( status, response ) {
                                res.status( 200 ).send( response );
                            } );
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

    /*this.getConversations = function ( req, res, next ) {
        var userId = req.session.uId;
        var srcNumber = req.params.src;
        var dstNumber = req.params.dst;
        var limit = req.query.limit;
        var type = 'userId';
        var options = {
            limit: limit
        };

        if( !dstNumber || !srcNumber ) {
            options.userId = userId;
        } else {
            type = "number";
            options.numbers = [dstNumber, srcNumber];
        }

        getConversationsByType( type, options, function ( err, conversations ) {
            if( err ) {
                next( err );
            } else {
                res.status( 200 ).send( {success: conversations} );
            }
        } );
    };*/

    this.getLastConversations = function ( req, res, next ) {
        var userId = req.session.uId;
        var ownerObject = {
            matchId: userId,
            groupType: 'owner'
        };
        var companionObject = {
            matchId: userId,
            groupType: 'companion'
        };
        var resultArray = [];
        //async.each( [ownerObject, companionObject], function ( options, callback ) {
        async.each( [ ownerObject ], function ( options, callback ) {
            lastConvObjects( options, function ( err, result ) {
                if( err ) {
                    callback( err );
                } else {
                    resultArray = resultArray.concat( result );
                    callback();
                }
            } );
        }, function ( err ) {
            if( err ) {
                next( err );
            } else {
                res.status( 200 ).send( {success: resultArray} );
            }
        } );
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
            chat: chat
        };
        projObj = {
            "_id": 0,
            chat: 0,
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
                    ]
                }
            },
            {
                $sort: { postedDate: -1 }
            },
            {
                $project: {
                    "_id": 0,
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

    this.getRecent = function ( req, res, next) {
        var userId = req.session.uId;
        var limit = parseInt(req.query.l) || 20;
        var page = parseInt(req.query.p) || 1;
        var skip = (page -1) * limit;

        Conversation.aggregate([
            {
                $match:{
                    $or:[
                        {"owner._id": userId }
                    ]
                }
            },
            {
                $sort: { postedDate:-1 }
            },
            {
                $project: {
                    "_id": 0,
                    body: 1,
                    chat: 1,
                    owner: 1,
                    companion: 1,
                    postedDate: 1
                }
            },
            {
                $group:{
                    _id: "$companion._id",
                    lastmessage: {
                        $first:"$$ROOT"
                    }
                }
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

    this.getRecent2 = function ( req, res, next) {
        var userId = req.session.uId;
        var limit = parseInt(req.query.l) || 20;
        var page = parseInt(req.query.p) || 1;
        var skip = (page -1) * limit;

        AddressBook.find(
            {
                $or:[
                    {
                        "owner._id": userId
                    },
                    {
                        "companion._id": userId
                    }
                ]
            },
            {
                companion: 1,
                "numbers.number": 1
            }
        ).exec(
            function ( err, contacts ) {
                var length;
                var contactIndex;
                var con
                var recents = [];

                if ( err ) {
                    return next(err);
                }

                length = contacts.length;
                async.each(
                    contacts,
                    function ( err, callback ) {
                        if ( err ) {
                            callback( err); //todo
                        }
                    }
                );
            }
        );

    }
};

module.exports = Message;