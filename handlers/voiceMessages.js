'use strict';
//TODO: numbers are stored with +

var NOT_ENAUGH_PARAMS = 'Not enough incoming parameters. ';
var DEFAULT_AUDIO_FILE_NAME = 'voiceMessage';
var DEFAULT_AUDIO_EXTENSION = '.mp3';
var DEFAULT_AUDIO_URL = 'voiceMessages/audio/';
var CONVERSATION_TYPES = require('./../constants/conversationTypes');
var EXTERNAL_USER_ID = '123456789';
var EXTERNAL_USER_FIRST_NAME = 'Anonymous';
var EXTERNAL_USER_LAST_NAME = 'Anonymous';

var async = require('async');
var fs = require('fs');
var path = require('path');
var lodash = require('lodash');
var util = require('util');
var request = require('request');
var sox = require('sox'); //https://www.npmjs.com/package/sox
var FileStorage = require('../modules/fileStorage');
var PushHandler = require('../handlers/push');
var SocketConnectionHandler = require('../handlers/socketConnections');
var UserHandler = require('../handlers/users');
var MessagesHandler = require('../handlers/messages');
var PlivoModule = require('../helpers/plivo');

var VoiceMessagesModule = function (db) {
    var fileStor = new FileStorage();
    var socketConnection = new SocketConnectionHandler(db);
    var userHandler = new UserHandler(db);
    var pushHandler = new PushHandler(db);
    var messagesHandler = new MessagesHandler(db);
    var AddressBook = db.model('addressbook');
    var Conversation = db.model('converstion');
    var plivo = new PlivoModule();
    var self = this;

    this.calculateChatString = function (src, dst) {
        var chat = '';

        if (src > dst) {
            chat = dst + ':' + src;
        } else {
            chat = src + ':' + dst;
        }

        return chat;
    };

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
        html += '<label for="src">src </label>';
        html += '<input type="text" name="src" value="+447441910183"/>';
        html += '<br>';
        html += '<label for="dst">dst </label>';
        html += '<input type="text" name="dst" value="+19192751968"/>';
        //html += '<input type="text" name="dst" value="80936610051"/>';
        //html += '<input type="text" name="dst" value="+3614088916"/>';
        html += '<br>';
        html += '<label for="voiceMsgFile">Voice message file </label>';
        html += '<input type="file" name="voiceMsgFile" />';
        html += '<br>';
        html += '<input type="submit"/>';
        html += '</form>';

        res.send(html);
    };

    function getAudioFileInfo(params, callback) {
        sox.identify(params.srcFilePath, function (err, results) {
            /* results looks like:
             {
             format: 'wav',
             duration: 1.5,
             sampleCount: 66150,
             channelCount: 1,
             bitRate: 722944,
             sampleRate: 44100,
             }
             */
            callback(err, results);
        });
    };

    function convertTheAudioFile(params, callback) {
        var from = params.srcFilePath;
        var to = params.dstFilePath;
        var format = params.format || 'mp3';

        var job = sox.transcode(from, to, {
            sampleRate: 44100,
            format: format,
            channelCount: 2,
            bitRate: 64 * 1024,
            compressionQuality: 2
        });

        job.on('error', function (err) {
            if (process.env.NODE_ENV !== 'produnction') {
                console.error(err);
            }
            if (callback && (typeof callback === 'function')) {
                callback(error);
            }
        });

        /*
         job.on('progress', function (amountDone, amountTotal) {
         console.log("progress", amountDone, amountTotal);
         });
         */

        job.on('src', function (info) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('>>> src: ');
                console.dir(info);
                /* info looks like:
                 {
                 format: 'wav',
                 duration: 1.5,
                 sampleCount: 66150,
                 channelCount: 1,
                 bitRate: 722944,
                 sampleRate: 44100,
                 }
                 */
            }
        });

        job.on('dest', function (info) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('>>> dest: ');
                console.dir(info);
                /* info looks like:
                 {
                 sampleRate: 44100,
                 format: 'mp3',
                 channelCount: 2,
                 sampleCount: 67958,
                 duration: 1.540998,
                 bitRate: 196608,
                 }
                 */
            }
        });

        job.on('end', function () {
            if (process.env.NODE_ENV !== 'production') {
                console.log("all done");
            }
            if (callback && (typeof callback === 'function')) {
                callback();
            }
        });

        job.start();
    };

    function saveTheAudioFile(file, callback) {
        var ticks = new Date().valueOf();
        var dirPath = path.join(path.dirname(require.main.filename), 'uploads');
        var extension = path.extname(file.path) || DEFAULT_AUDIO_EXTENSION;
        var fileName = DEFAULT_AUDIO_FILE_NAME + '_' + ticks + extension;
        var filePath = path.join(dirPath, fileName);

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
                var postOptions = {
                    data: fileData
                };

                fileStor.postFile(dirPath, fileName, postOptions, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    cb();
                });
            },

            //check the file format
            function (cb) {
                var fileUrl;
                var ticks = new Date().valueOf();
                var transcodeParams;
                var transcodeFileName;
                var transcodeFilePath;

                if (extension === DEFAULT_AUDIO_EXTENSION) {
                    fileUrl = process.env.HOST + '/' + DEFAULT_AUDIO_URL + fileName;
                    return cb(null, fileUrl);
                }

                transcodeFileName = DEFAULT_AUDIO_FILE_NAME + '_' + ticks + DEFAULT_AUDIO_EXTENSION;
                transcodeFilePath = path.join(dirPath, transcodeFileName);

                transcodeParams = {
                    srcFilePath: filePath,
                    dstFilePath: transcodeFilePath
                };

                convertTheAudioFile(transcodeParams, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    fileUrl = process.env.HOST + '/' + DEFAULT_AUDIO_URL + transcodeFileName;
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
        //TODO: validate incoming params;
        var src = params.src;
        var dst = params.dst;
        var dstUser = params.dstUser;
        var srcUser = params.srcUser;
        var fileUrl = params.fileUrl;
        var io = params.io;
        var socketConnectionObject = dstUser.socketConnection;
        var companion = dstUser.companion;
        var srcUserId = srcUser._id;
        var dstUserId = companion._id;
        var chat = self.calculateChatString(src, dst);
        //var credits; // send with response

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
                    type: CONVERSATION_TYPES.VOICE,
                    voiceURL: fileUrl,
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

            //send socket notification:
            function (conversationModel, cb) {
                var socketIds = socketConnectionObject.socketId;

                async.each(
                    socketIds,
                    function (socketId, eachCb) { // async.each iterator
                        var dstSocket = io.sockets.connected[socketId];

                        if (dstSocket) {
                            dstSocket.emit('receiveMessage', conversationModel);
                        }

                        eachCb();
                    },
                    function (err) {             // callback for async.each
                        if (err) {
                            if (process.env.NODE_ENV !== 'production') {
                                console.error(err);
                            }
                        } else {
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('>>> socketio emit "reciveMessage" is success.');
                            }
                        }
                    });

                cb(null, conversationModel);
            },

            //send push notification:
            function (conversationModel, cb) {
                var pushParams = {
                    toUser: dstUserId.toString(),
                    src: src,
                    dst: dst,
                    msg: 'You received a voice message. Link ' + fileUrl
                };

                if (companion && companion.enablepush) {
                    pushHandler.sendPush(pushParams);
                }

                cb(null, conversationModel);
            }

        ], function (err, conversation) {
            var result;

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {

                result = {
                    conversation: conversation/*,
                     credits: credits*/
                };

                if (callback && (typeof callback === 'function')) {
                    callback(null, result);
                }
            }
        });

    };

    this.sendExternalMessage = function (params, callback) {
        //TODO: validate incoming params;
        var src = params.src;
        var dst = params.dst;
        var srcUser = params.srcUser;
        var fileUrl = params.fileUrl;
        var srcUserId = srcUser._id;
        var chat = self.calculateChatString(src, dst);
        //var credits;

        async.waterfall([

            //create call
            function (cb) {
                var callParams = {
                    srcUser: srcUser,
                    src: src,
                    dst: dst,
                    fileUrl: fileUrl
                };

                plivo.createCall(callParams, function (err, result) {
                    if (err) {
                        return cb(err);
                    }
                    cb();
                });
            },

            //save conversation:
            function (cb) {
                var conversationData = {
                    type: CONVERSATION_TYPES.VOICE,
                    voiceURL: fileUrl,
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
                        _id: EXTERNAL_USER_ID,
                        name: {
                            first: EXTERNAL_USER_FIRST_NAME,
                            last: EXTERNAL_USER_LAST_NAME
                        },
                        number: dst
                    },
                    show: [srcUserId, EXTERNAL_USER_ID]
                };
                var conversationModel = new Conversation(conversationData);

                conversationModel.save(function (err, savedModel) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, savedModel);
                });
            }

        ], function (err, conversation) {
            var result;

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                result = {
                    conversation: conversation/*,
                     credits: creadits*/
                };

                if (callback && (typeof callback === 'function')) {
                    callback(null, result);
                }
            }
        });
    };

    this.sendMessage = function (req, res, next) {
        var err;
        var userId = req.session.uId;
        var params = req.body;
        var dst = params.dst;
        var src = params.src;

        if (!req.files || !req.files.voiceMsgFile) {
            err = new Error();
            err.message = NOT_ENAUGH_PARAMS + '"voiceMsgFile" was undefined';
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
                    var file = req.files.voiceMsgFile;

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
                sendMessageParams.io = req.app.get('io');

                if (results && results.dstUser) {
                    self.sendInternalMessage(sendMessageParams, function (err, result) {
                        if (err) {
                            return next(err);
                        }
                        res.status(201).send({success: 'message created', credits: result.credits});
                    });
                } else {
                    self.sendExternalMessage(sendMessageParams, function (err, result) {
                        if (err) {
                            return next(err);
                        }
                        res.status(201).send({success: 'message created', credits: result.credits});
                    });
                }

            }
        )
        ;
    };

    this.getAudioFile = function (req, res, next) {
        var fileName = req.params.fileName;
        var options = {
            root: path.join(path.dirname(require.main.filename), 'uploads')
        };

        res.sendFile(fileName, options, function (err) {
            if (err) {
                return next(err);
            }
        })
    };

    this.answerPlivo = function (req, res, next) {
        var fileUrl = req.query.file;
        var xml = plivo.generatePlayXML(fileUrl);

        res.status(200).send(xml);
    };

    this.inboundPlivo = function (req, res, next) {
        var body = req.body;
        var xml = plivo.generateRecordXML();

        if (process.env.NODE_ENV !== 'production') {
            console.log('Plivo inCall request:');
            console.dir(JSON.stringify(body));
        }

        res.status(200).send(xml);
    };

    this.sendInboundMessage = function (params, callback) {
        var src = params.src;
        var dst = params.dst;
        var plivoFileUrl = params.recordUrl;
        var io = params.io;
        var err;
        var dstUser;
        var socketConnectionObject;

        if (!src || !dst || !plivoFileUrl || !io) {
            err = new Error();
            err.message = NOT_ENAUGH_PARAMS + '. Required params: "src", "dst", "recordUrl", "io";';
            err.status = 400;
            return callback(err);
        }

        async.waterfall([

            //try to find the dst user:
            function (cb) {
                socketConnection.findSocket(dst, function (err, result) {
                    if (err) {
                        cb(err);
                    } else if (!result) {
                        err = new Error();
                        err.message = 'dstUser was not found';
                        err.status = 400;
                        cb(err);
                    } else {
                        dstUser = result.companion;
                        socketConnectionObject = result.socketConnection;
                        cb();
                    }
                });
            },

            //download and save the audio file:
            function (cb) {
                var ticks = new Date().valueOf();
                var dirPath = path.join(path.dirname(require.main.filename), 'uploads');
                var fileName = DEFAULT_AUDIO_FILE_NAME + '_' + ticks + DEFAULT_AUDIO_EXTENSION;
                var fileUrl = process.env.HOST + '/' + DEFAULT_AUDIO_URL + fileName;
                var filePath = path.join(dirPath, fileName);

                request(plivoFileUrl)
                    .pipe(fs.createWriteStream(filePath));

                cb(null, fileUrl);
            },

            //insert into conversations:
            function (fileUrl, cb) {
                var chat = self.calculateChatString(src, dst);
                var conversationData = {
                    type: CONVERSATION_TYPES.VOICE,
                    voiceURL: fileUrl,
                    chat: chat,
                    owner: {
                        _id: EXTERNAL_USER_ID,
                        name: {
                            first: EXTERNAL_USER_FIRST_NAME,
                            last: EXTERNAL_USER_LAST_NAME
                        },
                        number: src
                    },
                    companion: {
                        _id: dstUser._id,
                        name: {
                            first: dstUser.name.first,
                            last: dstUser.name.last
                        },
                        number: dst
                    },
                    show: [EXTERNAL_USER_ID, dstUser._id]
                };
                var conversationModel = new Conversation(conversationData);

                conversationModel.save(function (err, savedModel) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, savedModel);
                });
            },

            //send socket notification:
            function (conversationModel, cb) {
                //var socketConnectionObject = dstUser.socketConnection;
                var socketIds = socketConnectionObject.socketId;

                async.each(
                    socketIds,
                    function (socketId, eachCb) { // async.each iterator
                        var dstSocket = io.sockets.connected[socketId];

                        if (dstSocket) {
                            dstSocket.emit('receiveMessage', conversationModel);
                        }

                        eachCb();
                    },
                    function (err) {             // callback for async.each
                        if (err) {
                            if (process.env.NODE_ENV !== 'production') {
                                console.error(err);
                            }
                        } else {
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('>>> socketio emit "reciveMessage" is success.');
                            }
                        }
                    });

                cb(null, conversationModel);
            },

            //send push notification:
            function (conversationModel, cb) {
                var fileUrl = conversationModel.voiceURL;
                var pushParams = {
                    toUser: dstUser._id.toString(),
                    src: src,
                    dst: dst,
                    msg: 'You received a voice message. Link ' + fileUrl
                };

                if (dstUser && dstUser.enablepush) {
                    pushHandler.sendPush(pushParams);
                }

                cb(null, conversationModel);
            }

        ], function (err, conversationModel) {
            if (err) {
                return callback(err);
            }
            callback(null, conversationModel);
        });
    };

    this.plivoRecordCallback = function (req, res, next) {
        var options = req.body;
        var voiceMessageParams = {
            src: options.From,
            dst: options.To,
            recordUrl: options.RecordUrl,
            io: req.app.get('io')
        };

        res.status(200).send({success: true});

        self.sendInboundMessage(voiceMessageParams, function (err, results) {
            if (err) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error(err);
                }
                //return next(err);
            }
            //res.status(200).send({success: true});
        });

    };

    this.plivoHangup = function (req, res, next) {
        var body = req.body;

        if (process.env.NODE_ENV !== 'production') {
            console.log('Request to hangUp:\n');
            console.log(JSON.stringify(body));
        }

        res.status(200).send();
    };

    this.answerNexmo = function (req, res, next) {
        res.status(500).send({error: 'Not implemented yet'})
    };

};

module.exports = VoiceMessagesModule;