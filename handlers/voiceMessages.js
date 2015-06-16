'use strict';
//TODO: numbers are stored with +

var NOT_ENAUGH_PARAMS = 'Not enough incoming parameters. ';
var DEFAULT_AUDIO_FILE_NAME = 'voiceMessage';
var DEFAULT_AUDIO_EXTENSION = '.mp3';
var DEFAULT_AUDIO_URL = 'voiceMessages/audio/';
var CONVERSATION_TYPES = require('./../constants/conversationTypes');
var PROVIDER_TYPES = require('./../constants/providerTypes');
var NUMBER_TYPES = require('../constants/numberTypes');
var NUMBER_FEATURES = require('../constants/numberFeatures');
var EXTERNAL_USER_ID = '123456789';
var EXTERNAL_USER_FIRST_NAME = 'Anonymous';
var EXTERNAL_USER_LAST_NAME = 'Anonymous';

var async = require('async');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var util = require('util');
var request = require('request');
var sox = require('sox'); //https://www.npmjs.com/package/sox
var ffmpeg = require('fluent-ffmpeg'); //https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
var FileStorage = require('../modules/fileStorage');
var PushHandler = require('../handlers/push');
var SocketConnectionHandler = require('../handlers/socketConnections');
var UserHandler = require('../handlers/users');
var MessagesHandler = require('../handlers/messages');
var NewMessagesHandler = require('../handlers/newMessages');
var PlivoModule = require('../helpers/plivo');
var NexmoModule = require('../helpers/nexmo');
var badRequests = require('../helpers/badRequests');

var VoiceMessagesModule = function (db) {
    var fileStor = new FileStorage();
    var socketConnection = new SocketConnectionHandler(db);
    var userHandler = new UserHandler(db);
    var pushHandler = new PushHandler(db);
    var messagesHandler = new MessagesHandler(db);
    var newMessagesHandler = new NewMessagesHandler({}, db); //TODO: ...
    var AddressBook = db.model('addressbook');
    var Conversation = db.model('converstion');
    var plivo = new PlivoModule();
    var nexmo = new NexmoModule();
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

    this.checkCredits = function (params, callback) {
        var err;
        var userModel;
        var number;
        var priceParams;

        if (!params
            || !params.userModel
            || !params.number
            || (params.internal === undefined)
            || !params.msgType) {
            err = badRequests.NotEnParams({reqParams: ['userModel', 'number', 'internal', 'msgType']});
        }

        userModel = params.userModel;
        number = params.number;

        if (userModel.credits === undefined) {
            err = badRequests.InvalidValue({param: 'userModel', value: userModel});
        }

        if (!number.countryIso) {
            err = badRequests.InvalidValue({param: 'number', value: number});
        }

        if (err) {
            if (callback && (typeof callback === 'function')) {
                return callback(err);
            }
            return;
        }

        priceParams = {
            countryIso: number.countryIso,
            internal: params.internal,
            msgType: params.msgType
        };

        messagesHandler.getPrice(priceParams, function (err, price) {
            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else if (price > userModel.credits) {
                if (callback && (typeof callback === 'function')) {
                    callback(badRequests.NotEnCredits());
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

    this.findNumber = function (userModel, number, callback) {
        var numberObj = _.find(userModel.numbers, function (item) {
            return item.number === number;
        });

        if (!numberObj) {
            if (callback && (typeof callback === 'function')) {
                callback(badRequests.NotFound({message: 'number was not found'}));
            }
        } else {
            if (callback && (typeof callback === 'function')) {
                callback(null, numberObj);
            }
        }
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

        ffmpeg.setFfprobePath(process.env.FFMPEG_PROBE);
        ffmpeg.setFfmpegPath(process.env.FFMPEG_BIN);
        ffmpeg(from)
            .audioBitrate('128')
            .on('error', function (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            })
            .on('end', function () {
                if (callback && (typeof callback === 'function')) {
                    callback();
                }
            }).save(to);
    };

    function convertTheAudioFileSOX(params, callback) {
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
                callback(err);
            }
        });

        /*
         job.on('progress', function (amountDone, amountTotal) {
         console.log("progress", amountDone, amountTotal);
         });
         */

        job.on('src', function (info) {
            if (process.env.NODE_ENV !== 'production') {
                /*console.log('>>> src: ');
                 console.dir(info);*/
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
                /*console.log('>>> dest: ');
                 console.dir(info);*/
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
                /*console.log("all done");*/
            }
            if (callback && (typeof callback === 'function')) {
                callback();
            }
        });

        job.start();
    };

    function saveTheAudioFile(file, callback) {
        var ticks = new Date().valueOf();
        var dirPath = process.env.UPLOAD_DIR;
        var extension = path.extname(file.path);
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
                var oldFileUrl;
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

                    //remove the old file:
                    oldFileUrl = process.env.HOST + '/' + DEFAULT_AUDIO_URL + fileName;
                    removeAudioFileByUrl(oldFileUrl);

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

    function removeAudioFileByUrl(fileUrl, callback) {
        var fileName = '';
        var filePath = '';
        var err;

        if (!fileUrl || (typeof fileUrl !== 'string')) {
            err = new Error();
            err.message = NOT_ENAUGH_PARAMS + '"fileUrl" was undefined';
            err.status = 400;
            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
            return;
        }

        fileName = _.last(fileUrl.split('/'));
        filePath = path.join(process.env.UPLOAD_DIR, fileName);

        return removeAudioFile(filePath, callback);

    };

    function removeAudioFile(filePath, callback) {
        var err;

        async.waterfall([

            //is exists file:
            function (cb) {
                fs.exists(filePath, function (exists) {
                    if (!exists) {
                        err = new Error();
                        err.message = 'File "' + filePath + '" was not found.';
                        err.status = 400;
                        return cb(err);
                    }
                    cb();
                });
            },

            //try to remove:
            function (cb) {
                fs.unlink(filePath, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    cb();
                });
            }

        ], function (err) {
            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                if (callback && (typeof callback === 'function')) {
                    callback();
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
        var internal = true;

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

            //find numberObj:
            function (cb) {
                self.findNumber(srcUser, src, function (err, number) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, number);
                });
            },

            //check credits:
            function (number, cb) {
                var checkParams = {
                    userModel: params.srcUser,
                    number: number,
                    internal: internal, //true
                    msgType: CONVERSATION_TYPES.VOICE
                };

                self.checkCredits(checkParams, function (err) {
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
            },

            //subtract credits:
            function (conversationModel, cb) {
                messagesHandler.subCredits(srcUser, internal, src, function (err, credits) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, conversationModel, credits);
                });
            }

        ], function (err, conversation, credits) {
            var result;

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {

                result = {
                    conversation: conversation,
                    credits: credits
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
        var internal = false;
        //var credits;

        async.waterfall([

            //find numberObj:
            function (cb) {
                self.findNumber(srcUser, src, function (err, number) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, number);
                });
            },

            //check credits:
            function (number, cb) {
                var checkParams = {
                    userModel: params.srcUser,
                    number: number,
                    internal: internal, //true
                    msgType: CONVERSATION_TYPES.VOICE
                };

                self.checkCredits(checkParams, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, number);
                });
            },

            //find the provider:
            function (number, cb) {
                if (!number || !number.provider) {
                    return cb(badRequests.InvalidValue({param: 'number.provider', value: number}));
                }

                if (number.provider === PROVIDER_TYPES.PLIVO) {
                    return cb(null, plivo);
                } else if (number.provider === PROVIDER_TYPES.NEXMO) {
                    return cb(null, nexmo);
                } else {
                    return cb(badRequests.IncorrectProvider());
                }
            },

            //create call:
            function (provider, cb) {
                var callParams = {
                    srcUser: srcUser,
                    src: src,
                    dst: dst,
                    fileUrl: fileUrl
                };

                if (!provider || !provider.createCall) {
                    return cb(badRequests.InvalidValue({param: 'provider', value: provider}));
                }

                //return cb();

                provider.createCall(callParams, function (err, result) {
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
            },

            //subtract credits:
            function (conversationModel, cb) {
                messagesHandler.subCredits(srcUser, internal, src, function (err, credits) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, conversationModel, credits);
                });
            }

        ], function (err, conversation, credits) {
            var result;

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                result = {
                    conversation: conversation,
                    credits: credits
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

        if (src[0] !== '+') {
            src = '+' + src;
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
                            if (results.fileUrl) {
                                removeAudioFileByUrl(results.fileUrl);
                            }
                            return next(err);
                        }
                        res.status(201).send({
                            success: 'message created',
                            message: result.conversation,
                            credits: result.credits
                        });
                    });
                } else {
                    self.sendExternalMessage(sendMessageParams, function (err, result) {
                        if (err) {
                            if (results.fileUrl) {
                                removeAudioFileByUrl(params.fileUrl);
                            }
                            return next(err);
                        }
                        res.status(201).send({
                            success: 'message created',
                            message: result.conversation,
                            credits: result.credits
                        });
                    });
                }

            }
        );
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

        if (process.env.NODE_ENV !== 'production') {
            console.log('>>> ', req.originalUrl);
            console.log(util.inspect(req.body, { showHidden: true, depth: 5 }));
        }

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

        if (src[0] !== '+') {
            src = '+' + src;
        }

        if (dst[0] !== '+') {
            dst = '+' + dst;
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
        if (process.env.NODE_ENV !== 'production') {
            console.log('>>> ', req.originalUrl);
            console.log(util.inspect(req.body, { showHidden: true, depth: 5 }));
        }

        var options = req.body;
        var src = options.From;
        var dst = options.To;
        var recordUrl = options.recordUrl;
        var voiceMessageParams;

        voiceMessageParams = {
            src: src,
            dst: src,
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

    this.testDeleteOldMessages = function (req, res, next) {
        self.deleteOldMessages(function (err, result) {
            if (err) {
                return next(err);
            }
            res.status(200).send({success: true, result: result});
        });
    };

    this.deleteOldMessages = function (callback) {
        var models;
        var now = new Date();
        var criteria = {
            type: CONVERSATION_TYPES.VOICE,
            $or: [{
                read: false,
                saved: false,
                postedDate: {
                    $lte: new Date(now - (1000 * 60 * 60 * 24 * 7)) // 7 days before
                }
            }, {
                read: true,
                saved: false,
                postedDate: {
                    $lte: new Date(now - (1000 * 60 * 60 * 24 * 3)) // 3 days before
                }
            }, {
                saved: true,
                postedDate: {
                    $lte: new Date(now - (1000 * 60 * 60 * 24 * 14)) // 14 days before
                }
            }, {
                postedDate: {
                    $lte: new Date(now - (1000 * 60 * 60 * 24 * 14)) // 14 days before
                }
            }]
        };
        var fields = {
            type: 1,
            postedDate: 1, //TODO: remove this field
            voiceURL: 1
        };

        Conversation.find(criteria, fields, function (err, conversationModels) {
            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
                return;
            }

            models = conversationModels;

            async.parallel([

                //try to remove audio files:
                function (cb) {
                    var fileUrls = _.pluck(models, 'voiceURL');

                    async.each(fileUrls,
                        function (url, eachCb) {
                            removeAudioFileByUrl(url, function (err) {
                                if (err) {
                                    if (process.env.NODE_ENV !== 'production') {
                                        console.error(err);
                                    }
                                }
                                eachCb();
                            });
                        }, function (err) {
                            if (err) {
                                return cb(err);
                            }
                            cb();
                        })
                },

                //try to remove conversation models:
                function (cb) {
                    var ids = _.pluck(models, '_id');
                    var criteria = {
                        _id: {
                            $in: ids
                        }
                    };

                    Conversation.remove(criteria, function (err, result) {
                        if (err) {
                            return cb(err);
                        }
                        cb();
                    });
                }

            ], function (err) {
                if (err) {

                    if (callback && (typeof callback === 'function')) {
                        callback(err);
                    }
                    if (process.env.NODE_ENV !== 'production') {
                        console.error(err);
                    }

                } else {
                    if (callback && (typeof callback === 'function')) {
                        callback(null, models);
                    }
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('>>> deleteOldMessages cron job was finished success');
                    }
                }
            });
        });
    };

    this.getNumberPriceByCountry = function (params, callback) {
        var countryIso = params.countryIso;
        var feature = params.feature || NUMBER_FEATURES.SMS_AND_VOICE;

        async.parallel({

            // try to find plivo numbers in the given country:
            countPlivo: function (cb) {
                var params = {
                    country: countryIso,
                    type: NUMBER_TYPES.LOCAL,
                    feature: feature
                };

                plivo.searchNumber(params, function (err, response) {
                    var count = 0;

                    if (err) {
                        return cb(err);
                    }

                    if (response && response.meta && response.meta.total_count) {
                        count = response.meta.total_count;
                    }

                    cb(null, count);
                });
            },

            //try to find price in the given country:
            pricePlivo: function (cb) {
                var params = {
                    countryIso: countryIso,
                    type: NUMBER_TYPES.LOCAL
                };

                plivo.getNumberPriceByCountry(params, function (err, response) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, response);
                });
            },

            // try to find nexmo numbers in the given country:
            countNexmo: function (cb) {
                var params = {
                    countryIso: countryIso,
                    feature: feature
                };

                nexmo.searchNumber(params, function (err, response) {
                    var count = 0;

                    if (err) {
                        return cb(err);
                    }

                    if (response && response.count) {
                        count = response.count;
                    }

                    cb(null, count);
                });
            },

            //try to find price in the given country:
            priceNexmo: function (cb) {
                var params = {
                    countryIso: countryIso
                };

                nexmo.getNumberPriceByCountry(params, function (err, response) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, response);
                });
            }

        }, function (err, results) {
            var providers = [];

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                providers.push({
                    name: PROVIDER_TYPES.PLIVO,
                    count: results.countPlivo,
                    price: results.pricePlivo,
                    countryIso: countryIso,
                    feature: feature
                });

                providers.push({
                    name: PROVIDER_TYPES.NEXMO,
                    count: results.countNexmo,
                    price: results.priceNexmo,
                    countryIso: countryIso,
                    feature: feature
                });

                if (callback && (typeof callback === 'function')) {
                    callback(null, providers);
                }
            }
        });
    };

    this.getCheapestProviderByCountry = function (countryIso, callback) {
        var params = {
            countryIso: countryIso
        };

        self.getNumberPriceByCountry(params, function (err, result) {
            var providers;
            var cheapestProvider;

            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {

                providers = _.sortBy(result, 'price');

                if (providers[0].count) {
                    cheapestProvider = providers[0];
                } else if (providers[1].count) {
                    cheapestProvider = providers[1];
                } else {
                    cheapestProvider = null;
                }

                if (callback && (typeof callback === 'function')) {
                    callback(null, cheapestProvider);
                }

            }
        });
    };

    this.testGetCheapestProviderByCountry = function (req, res, next) {
        var options = req.query;
        var countryIso = options.countryIso || 'us';

        self.getCheapestProviderByCountry(countryIso, function (err, result) {
            if (err) {
                return next(err);
            }
            res.status(200).send(result);
        });
    };

    this.testGetNumberPriceByCountry = function (req, res, next) {
        var options = req.query;
        var params = {
            countryIso: options.countryIso || 'us'
        };

        self.getNumberPriceByCountry(params, function (err, result) {
            if (err) {
                return next(err);
            }
            res.status(200).send(result);
        });

    };
};

module.exports = VoiceMessagesModule;