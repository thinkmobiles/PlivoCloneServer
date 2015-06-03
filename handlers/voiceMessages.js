'use strict';

var NOT_ENAUGH_PARAMS = 'Not enough incoming parameters. ';
var DEFAULT_AUDIO_FILE_NAME = 'voiceMessage';
var DEFAULT_AUDIO_EXTENSION = '.mp3';
var DEFAULT_AUDIO_URL = '/voiceMessages/audio/';

var fs = require('fs');
var plivo = require('plivo-node');
var p = plivo.RestAPI({
    "authId": process.env.PLIVO_AUTH_ID,
    "authToken": process.env.PLIVO_AUTH_TOKEN
});
var async = require('async');
var path = require('path');
var lodash = require('lodash');
var util = require('util');
var FileStorage = require('../modules/fileStorage');
var PushHandler = require('../handlers/push');
var SocketConnectionHandler = require('../handlers/socketConnections');
var UserHandler = require('../handlers/users');

var VoiceMessagesModule = function (db) {
        var fileStor = new FileStorage();
        var socketConnection = new SocketConnectionHandler(db);
        var userHandler = new UserHandler(db);
        var pushHandler = new PushHandler(db);
        var AddressBook = db.model('addressbook');
        var Conversation = db.model('converstion');
        var self = this;

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

        this.sendTestForm = function (req, res, next) {
            var html = '';

            html += '<!doctype html>';
            html += '<h2>Test Form to send VoiceMessages</h2>';
            html += '<form method="POST" action="send" enctype="multipart/form-data">';
            html += '<label for="src">src</label>';
            html += '<input type="text" name="src" value="380936610051"/>';
            html += '<br>';
            html += '<label for="dst">dst</label>';
            html += '<input type="text" name="dst" value="380936610051"/>';
            html += '<br>';
            html += '<label for="message">Message</label>';
            html += '<input type="file" name="message" />';
            html += '<br>';
            html += '<input type="submit"/>';
            html += '</form>';

            res.send(html);
        };

        function saveTheAudioFile(file, callback) {

            async.waterfall([

                //get file from request:
                function (cb) {
                    fs.readFile(file.path, function (err, data) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, data);
                    });
                },

                //save file to storage:
                function (fileData, cb) {
                    var ticks = new Date().valueOf();
                    var dirPath = path.join(path.dirname(require.main.filename), 'uploads'); //TODO: require.main.filename
                    var fileName = DEFAULT_AUDIO_FILE_NAME + '_' + ticks + DEFAULT_AUDIO_EXTENSION;
                    var fileUrl = DEFAULT_AUDIO_URL + fileName;
                    var postOptions = {
                        data: fileData
                    };

                    fileStor.postFile(dirPath, fileName, postOptions, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, fileUrl);
                    });
                }

            ], function (err, fileUrl) {
                if (err) {
                    if (callback && (typeof callback === 'function')) {
                        callback(err);
                    }
                } else {
                    if (callback && (typeof callback === 'function')) {
                        callback(null, fileUrl);
                    }
                }
            });
        };

        this.sendInternalMessage = function (params, callback) {
            var src = params.src;
            var dst = params.dst;
            var dstUser = params.dstUser;
            var srcUser = params.srcUser;
            var io = params.io;
            var socketConnectionObject = dstUser.socketConnection;
            var companion = dstUser.companion;
            var srcUserId = srcUser._id;
            var dstUserId = companion._id;
            var chat;

            if (src > dst) {
                chat = dst + ':' + src;
            } else {
                chat = src + ':' + dst;
            }

            async.waterfall([

                //check blocked number;
                function (cb) {
                    var checkParams = {
                        dstUserId: dstUserId,
                        number: src
                    };
                    self.checkBlockedNumbers(checkParams, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        cb();
                    });
                },

                //save into conversations:
                function (cb) {
                    var conversationData = {
                        chat: chat,
                        owner: {
                            _id: srcUserId,
                            name: {
                                first: srcUser.name.first,
                                last: srcUser.name.last
                            },
                            number: src
                        },
                        companion: {
                            _id: dstUserId,
                            name: {
                                first: companion.name.first,
                                last: companion.name.last
                            },
                            number: dst
                        },
                        show: [srcUserId, dstUserId]
                    };
                    var conversationModel = new Conversation(conversationData);

                    conversationModel.save(function (err, savedModel) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, savedModel);
                    });
                },

                //subtract credits:
                function (conversationModel, cb) {
                    cb(null, conversationModel); //TODO: ...
                },

                //send socket notification:
                function (cb) {
                    cb(); //TODO: ...
                },

                //send push notification:
                function (cb) {
                    if (companion && companion.enablepush) {
                        push.sendPush(sendToUserId.toString(), params.src, conversation.body, JSON.stringify(launchMsg));
                    }
                    cb(); //TODO: ...
                }

            ], function (err, result) {
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

        this.sendExternalMesasge = function (params, callback) {

        };

        this.sendMessage = function (req, res, next) {
            var err;
            var userId = req.session.uId;
            var params = req.body;
            var dst = params.dst;
            var src = params.src;
            //var isInternal;

            if (!req.files || !req.files.message) {
                err = new Error();
                err.message = NOT_ENAUGH_PARAMS + '"message" was undefined';
                err.status = 400;

                return next(err);
            }

            if (!src || !dst) {
                err = new Error();
                err.message = NOT_ENAUGH_PARAMS + '"src" and "dst" are required params';
                err.status = 400;

                return next(err);
            }

            async.parallel({

                    //try to find dst user:
                    dstUser: function (cb) {
                        socketConnection.findSocket(dst, function (err, response) {
                            if (err) {
                                cb(err);
                            } else if (response) {
                                //isInternal = true;
                                cb(null, response);
                            } else {
                                //isInternal = false;
                                cb(null, null);
                            }
                        });
                    },

                    //find the srcUser (currentUser):
                    srcUser: function (cb) {
                        userHandler.findUserById(userId, function (err, userModel) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, userModel);
                        });
                    },

                    //save the audio file:
                    fileUrl: function (cb) {
                        var file = req.files.message;

                        saveTheAudioFile(file, function (err, result) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, result);
                        });
                    }

                }, function (err, results) {
                    var sendMessageParams;

                    if (err) {
                        return next(err);
                    }

                    sendMessageParams = results;
                    sendMessageParams.src = src;
                    sendMessageParams.dst = dst;
                    sendMessageParams.io = req.app.io;

                    if (results && results.dstUser) {
                        self.sendInternalMessage(sendMessageParams, function (err, result) {
                            if (err) {
                                return next(err);
                            }
                            res.status(200).send({success: true, result: result});
                        });
                    } else {
                        //self.sendExternalMesasge(sendMessageParams, function (err, result) {
                        self.sendInternalMessage(sendMessageParams, function (err, result) {
                            if (err) {
                                return next(err);
                            }
                            res.status(200).send({success: true, result: result});
                        });
                    }

                }
            )
            ;
        };
    }
    ;

module.exports = VoiceMessagesModule;