/**
 * Created by User on 16.04.2015.
 */

var AddressBook = function(db) {

    var mongoose = require('mongoose');
    var fs = require('fs');
    var path = require('path');
    var lodash = require('lodash');
    var async = require('async');
    var FileStorage = require('../modules/fileStorage');
    var AddressBook = db.model('addressbook');
    var newObjectId = mongoose.Types.ObjectId;
    var fileStor = new FileStorage();
    var crypto = require('crypto');
    var badRequests = require('../helpers/badRequests');

    this.getAddressBook = function (req, res, next) {
        var desc = (req.query.desc == 0) ? 1 : -1;
        var userId = req.session.uId;
        var limit = req.query.l || 20;
        var page = req.query.p || 1;
        var filter = req.query.q;

        var sortObj = {
            companion: desc
        };
        var queryObj = {
            refUser: newObjectId(userId)
        };
        var projObj = {
            "_id": 0,
            refUser: 0,
            "__v": 0,
            "numbers._id": 0
        };

        if (req.query.q) {
            queryObj.companion = new RegExp('^' + filter, "i");
        }
        console.log(queryObj);

        AddressBook
            .find(queryObj, projObj)
            .sort(sortObj)
            .skip(page > 0 ? ( page - 1 ) * limit : 0)
            .limit(limit)
            .exec(function (err, entries) {
                if (err) {
                    return next(err);
                }
                return res.status(200).json(entries)
            });

    };

    /*this.getAvatar = function (req, res, next){
     var userId = req.session.uId;
     var companion = req.params.companion;
     var queryObj = {
     refUser: newObjectId( userId ),
     companion: companion
     };
     var projObj = {
     "_id": 0,
     refUser: 0,
     "__v": 0,
     "numbers": 0
     }

     AddressBook
     .find(queryObj, projObj)
     .exec(function(err, entries){
     if (err){
     return next(err);
     }
     return res.status(200).json(entries)
     });

     };*/

    this.deleteAddressBookEntry = function (req, res, next) {
        var companion = req.params.companion;
        var userId = req.session.uId;
        var queryObj = {
            refUser: newObjectId(userId),
            companion: companion
        };
        var projObj = {
            select: {companion: true} //todo add for select only companion
        };

        AddressBook.findOneAndRemove(queryObj, function (err, entry) {
            if (err) {
                return next(err);
            }
            res.status(200).send({success: 'contact ' + companion + ' deleted'});
        })
    };

    this.addAddresbookEntry = function (req, res, next) {
        var numbers = req.body.numbers;
        var userId = req.session.uId;
        var body = req.body;
        var companion = body.companion;
        var numArr = lodash.pluck(numbers, 'number');
        var queryObj = {
            refUser: newObjectId(userId),
            companion: companion
        };
        var projObj = {
            _id: 1
        };

        AddressBook.findOne(queryObj, projObj, function (err, entry) {
            if (err) {
                return next(err);
            }
            if (entry) {
                //return res.status(409).send({success: "addressBook entry " + companion + 'exist'});
                return next(badRequests.DuplicateEntry({message: 'addressBook entry ' + companion + ' exist', status: 409}));
            }

            body.refUser = newObjectId(userId);
            getAllAddressBookNumber(userId, function (err, allNumbers) {
                var existNumbers;
                var newEntry;

                if (err) {
                    return next(err);
                }

                existNumbers = lodash.intersection(allNumbers, numArr);

                if (existNumbers.length) {
                    return res.status(409).send({success: existNumbers}); //TODO: ...
                    //return next(badRequests.DuplicateEntry({message: 'addressBook entry ' + companion + ' exist', status: 409}));
                }

                //todo chack if undefined body.numbers generate []
                newEntry = new AddressBook(body);
                newEntry.save(function (err, entry) {
                    if (err) {
                        return next(err);
                    }

                    res.status(201).send({success: "addressBook entry " + companion + 'added'});
                });
            });

        });
    };

    this.updateAddresbookEntry = function (req, res, next) {
        var userId = req.session.uId;
        var body = req.body;
        var companion = req.params.companion;
        var queryObj = {
            refUser: newObjectId(userId),
            companion: companion
        };
        var projObj = {
            numbers: 1
        };
        var updateObj = {$set: body};

        var tasks = [];


        AddressBook.findOne(queryObj, projObj, function (err, entry) {
            if (err) {
                return next(err);
            }

            if (!entry) {
                return res.status(403).send({success: companion + ' Nnot found'}); //TODO: ...
            }

            function numberIsOccupied(callback) {
                getAllAddressBookNumber(userId, function (err, allNumbers) {
                    var existNumbers;

                    if (err) {
                        return callback(err);
                    }
                    existNumbers = lodash.intersection(allNumbers, numArr);

                    if (existNumbers.length) {
                        err = new Error('number exist');
                        err.status = 409;
                        return callback(err)
                    }

                    callback(null);

                });
            }

            function saveAddressBookAvatar(callback) {

                function writeToLocalStorage(name, base64Avatar, callback) {
                    var storagePath = path.join('../public/images');
                    var imgBuffer = new Buffer(base64Avatar, 'base64');
                    var dirName = path.join(storagePath, req.session.uId);
                    var imgName = path.join(dirName, entry._id.toString());

                    if (fs.existsSync(storagePath)) {

                        err = new Error('storage not found');
                        err.status = 404;

                        return callback(err);
                    }

                    fs.exists(dirName, function (isExist) {

                        if (!isExist) {

                            fs.mkdir(dirName, function (err) {

                                if (err) {
                                    return callback(err);
                                }

                                fs.writeFile(imgName, imgBuffer, function (err) {
                                    if (err) {
                                        return next(err);
                                    }
                                    callback(null);
                                })

                            });
                        }

                        fs.writeFile(path.join(dirName, imgName) + '.jpg', imgBuffer, function (err) {

                            if (err) {
                                callback(err);
                            }

                        });

                    });

                }

                updateObj['$set'].avatar = avatarUrl;
                callback(null)
            }

            function updateAddressBook(callback) {

                AddressBook.update({"_id": entry._id}, updateObj)
                    .exec(function (err, result) {

                        if (err) {
                            return callback(err);
                        }
                        callback(null);

                    });
            }

            if (body.numbers) {
                tasks.push(numberIsOccupied);
            }

            if (body.avatar) {
                tasks.push(saveAddressBookAvatar)
            }

            tasks.push(updateAddressBook);

            async.waterfall(tasks, function (err, result) {

                if (err) {
                    //return res.status(404).send(err.message); /TODO: status = 404
                    err.status = 404;
                    return next(err);
                }
                res.status(200).send({success: companion + " updated successfully"});

            });

            /*if ( body.numbers ) {
             getAllAddressBookNumber( userId, function( err, allNumbers ) {
             var existNumbers;
             var oldNumbers = lodash.pluck( entry.numbers, 'number' );
             var newNumbers = lodash.pluck( body.numbers, 'number' );
             var usedNumbers = lodash.difference( allNumbers, oldNumbers );

             if ( err ) {
             return next(err);
             }

             existNumbers = lodash.intersection( usedNumbers, newNumbers );

             if ( existNumbers.length ) {
             return res.status( 409 ).send( {success: existNumbers} )
             }

             AddressBook.update( {"_id": entry._id }, updateObj)
             .exec( function( err, result ) {
             if ( err ) {
             return next( err );
             }
             res.status( 200 ).send({success: companion +  " updated successfully"});
             });
             });
             } else {
             AddressBook.update( {"_id": entry._id }, updateObj)
             .exec( function( err, result ) {
             if ( err ) {
             return next( err );
             }
             res.status( 200 ).send({success: companion +  " updated successfully"});
             });
             }*/
        });

    };

    this.addNumberToContact = function (req, res, next) {
        var companion = req.body.companion;
        var numbers = req.body.numbers;
        var userId = req.session.uId;
        var numArr = lodash.pluck(numbers, 'number');

        getAllAddressBookNumber(userId, function (err, allNumbers) {
            var existNumbers;

            if (err) {
                return next(err);
            }
            existNumbers = lodash.intersection(allNumbers, numArr);
            if (existNumbers.length) {
                //return res.status(409).send( JSON.stringify( existNumbers ) )
                return next(badRequests.DuplicateEntry({message: JSON.stringify( existNumbers )}));
            }

            AddressBook.update(
                {
                    refUser: newObjectId(userId),
                    companion: companion
                },
                {
                    $pushAll: {
                        numbers: numbers
                    }
                }
            ).exec(
                function (err, result) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).send( { success: "numbers addedd succefuly" } )
                }
            );
        });
    };

    function getAllAddressBookNumber(userId, callback) {
        var getNumbersAggregate;

        getNumbersAggregate = [
            {
                $match: {
                    refUser: newObjectId(userId)
                }
            },
            {
                $unwind: "$numbers"
            },
            {
                $group: {
                    "_id": "$refUser",
                    numbers: {
                        $push: "$numbers.number"
                    }
                }
            }
        ];

        AddressBook.aggregate(getNumbersAggregate)
            .exec(function (err, result) {
                if (err) {
                    return callback(err);
                }
                if (!result[0]) {
                    result = [
                        {
                            numbers: []
                        }
                    ];
                }
                callback(null, result[0].numbers);
            })
    }


    this.blockNumbers = function (req, res, next) {
        var userId = req.session.uId;
        var numbers = req.body;

        function changeNumberBlock(number, callback) {
            AddressBook.update(
                {
                    refUser: userId,
                    "numbers.number": number.number
                },
                {
                    $set: {
                        "numbers.$.isBlocked": number.isBlocked
                    }
                }
            ).exec(function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
        }

        async.each(numbers, changeNumberBlock, function (err) {
            if (err) {
                return next(err)
            }
            res.status(200).send( { success: "successful blocked/unblocked" } );
        })
    };

    function updateContact(isNew, userId, contactName, contactBody, callback) {
        var oldNumbers = [];

        function getContact( callback ) {

            var findConditions = {
                refUser: userId,
                companion: contactName
            };

            var findFields = {
                numbers: 1
            };


            AddressBook.findOne( findConditions, findFields )
                .exec(function (err, model) {

                    if ( err ) {

                        return callback(err);

                    }

                    if ( model && isNew ){

                        err = new Error('contact name '+ contactBody.companion +' exist');
                        err.status = 409;
                        return callback( err );

                    }

                    if ( !model && !isNew ){

                        err = new Error('contact name '+ contactBody.companion +' not found');
                        err.status = 404;
                        return callback( err );

                    }

                    if ( !model && isNew ) {

                        model = new AddressBook( contactBody );
                        model.refUser = userId;

                    } else {

                        oldNumbers = model.toObject();
                        oldNumbers = lodash.cloneDeep(oldNumbers.numbers);

                    }

                    callback(null, model)
                });
        }

        function checkNumber(model, callback) {
            if (!contactBody.numbers) {
                return callback(null, model);
            }
            getAllAddressBookNumber(userId, function (err, allNumbers) {
                var newNumbers = lodash.pluck(contactBody.numbers, 'number');
                oldNumbers = lodash.pluck(oldNumbers, 'number');
                var usedNumbers = lodash.difference(allNumbers, oldNumbers);
                var existNumbers = lodash.intersection(usedNumbers, newNumbers);

                /*TODO test new and remove old*/
                /*if (existNumbers.length) {
                    err = new Error( JSON.stringify( existNumbers ) );
                    err.status = 409;
                    return callback(err)
                }*/

                if (existNumbers.length) {
                    err = new Error( 'Number(s) belong to another contact' );
                    err.data = existNumbers ;
                    err.status = 409;
                    return callback(err)
                }

                callback(null, model)
            })
        }

        function saveContact(model, callback) {
            model.set(contactBody);
            /*model.save()
             .exec( function( err, result ) {

             if ( err ) {
             return callback( err );
             }

             callback( null );

             });*/
            model.save(function (err, result) {

                if (err) {
                    return callback(err);
                }

                callback(null);

            })
        }

        function saveAvatar(model, callback) {
            var postOptions;
            var date = new Date();
            var dirPath = path.join(path.dirname(require.main.filename), 'uploads');
            var fileName = model._id.toString() + '.jpg';
            var avatarUrl = 'addressbook/avatar/' + date.valueOf() + '_' + fileName;
            //var userDir = userId;
            var base64File;
            var data;

            if (!contactBody.avatar) {
                return callback(null, model);
            }

            base64File = contactBody.avatar;
            postOptions = {
                data : new Buffer(base64File, 'base64')
            };


            fileStor.postFile(dirPath, fileName, postOptions, function (err) {
                if (err) {
                    return callback(err);
                }
                contactBody.avatar = avatarUrl;
                callback(null, model);
            });

            /*fs.writeFile( fileName, data, function( err ){
             if ( err ) {
             return callback( err );
             }
             contactBody.avatar = avatarUrl;
             callback( null, model )
             });*/
        }

        async.waterfall([getContact, checkNumber, saveAvatar, saveContact], function (err) {
            if (err) {
                return callback(err);
            }
            callback(null);
        })

    }

    this.updateMyContact = function ( req, res, next) {
        var userId = req.session.uId;
        var contactBody = req.body;
        var isNew = req.params.companion ? false : true;
        var contactName = req.params.companion || contactBody.companion;
        var msg;

        //delete contactBody.show;

        updateContact(
            isNew,
            userId,
            contactName,
            contactBody,
            function( err ) {
                if ( err ) {
                    return next( err ); //todo change status and error
                }
                if ( contactBody.avatar ) {
                    msg = {
                        avatar: contactBody.avatar
                    }
                }
                res.status(200).send( msg || {} );
            }
        );

    };

    this.getImage = function (req, res, next) {
        var fileName = req.params.filename;
        var options = {
            root: path.join(path.dirname(require.main.filename), 'uploads')
        };

        fileName = fileName.slice( fileName.indexOf('_') + 1 );

        res.sendFile(fileName, options, function (err) {
            if (err) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(
                        'SendFile Error: ', err.message, '\n',
                        'Stack: ', err.stack
                    );
                }

                res.status( err.status).end();
            }
        })
    };
};

module.exports = AddressBook;