/**
 * Created by Roman on 12.02.2015.
 */
var User = function ( db ) {
    var expess = require('express');
    var mongoose = require( 'mongoose' );
    var fs = require('fs');
    var path = require('path');
    var FileStorage = require('../modules/fileStorage');
    var badRequests = require('../helpers/badRequests');
    var User = db.model( 'user' );
    var AddressBook = db.model('addressbook');
    var Price = db.model('countries');
    var crypto = require( 'crypto' );
    var SessionHandler = require( './sessions' );
    var lodash = require('lodash');
    var async = require( 'async' );
    var session = new SessionHandler( db );
    var newObjectId = mongoose.Types.ObjectId;
    var fileStor = new FileStorage();
    var self = this;

    function updateUser( userId, setObject, queryOptions, callback ) {
        if( arguments.length === 3 ) {
            callback = queryOptions;
        }
        User.findByIdAndUpdate( userId, setObject, queryOptions, function ( err, updetedUser ) {
            if( err ) {
                callback( err )
            } else {
                callback( null, updetedUser );
            }
        } );
    }

   /* function updateAddressBook (findObject, setObject, callback) {
        if (err) {
                callback(err);
            } else {
                callback(null, user)
            }
        })
    }*/

    this.signUp = function ( req, res, next ) {
        var userBody = req.body;
        console.log('Incomming SignUp:');
        console.log(userBody);
        var password = userBody.password;
        var email = userBody.email;
        var mobile = userBody.mobile;
        var shaSum = crypto.createHash( 'sha256' );
        var user;

        //if (!password || !email || !mobile) {
        if (!password || !email) {
            /*err = new Error('Not all parameters is set');
            err.status = 400;
            return next(err);*/
            return next(badRequests.NotEnParams({message: 'Not all parameters is set'}));
        }

        shaSum.update( password );
        userBody.password = shaSum.digest( 'hex' );

        User.findOne( {email: email.toLowerCase()}, function ( err, user ) {
            if( err ) {
                next( err );
            } else if( user && user._id ) {
                next(badRequests.DuplicateEntry({message: "user exist with email " + email}));
            } else {
                user = new User( userBody );
                user.save( function ( err, user ) {
                    if( err ) {
                        next( err );
                    } else {
                        res.status( 201 ).send( {success: "user created", uId: user._id} );
                    }
                } );
            }
        } );
    };

    this.signOut = function ( req, res, next ) {
        session.kill( req, res );
    };

    this.signIn = function ( req, res, next ) {
        var userBody = req.body;
        var password = userBody.password;
        var shaSum = crypto.createHash( 'sha256' );
        var errorObject;

        if( userBody.email && userBody.password ) {
            shaSum.update( password );
            userBody.password = shaSum.digest( 'hex' );
            User.findOne( userBody, function ( err, curUser ) {
                if( !err ) {
                    if( curUser && curUser._id ) {
                        session.register( req, res, curUser );
                    } else {
                        //res.status( 403 ).send( { success: "Wrong login or password" } );
                        next(badRequests.SignInError({message: 'Wrong login or password', status: 403}));
                    }
                } else {
                    next( err );
                }
            } )
        } else {
            //errorObject = new Error( "Wrong input data" );
            //errorObject.status = 400;
            next( badRequests.NotEnParams({message: 'Wrong input data'}) )
        }
    };


   this.extendNumber = function(req, res, next){  //todo test
        var params = req.body;
        var number = params.number;
        var countryIso = params.countryIso;
        var packageName = params.packageName;
        var numberPrice;
        var numberDuration;
        var numberDateExpire;
        var userId = req.session.uId;
        var userCredits;
        var findObject;
        var dateExpire;

        var left;

        User.findOne({_id: userId}, function (err, resultUser) {
            if (err) {
                return next(err);
            }
            else {
                userCredits = resultUser.credits;
                numberDateExpire = lodash.findWhere(resultUser.numbers, {number: number})['expire'];

                findObject = {
                    countryIso: countryIso
                };

                Price.findOne(findObject, function(err, result){
                    if (err){
                        return next(err);
                    }
                    if (result && result.extendNumberPackages){
                        numberPrice = lodash.findWhere(result.extendNumberPackages, {packageName: packageName})['price'];
                        numberDuration = lodash.findWhere(result.extendNumberPackages, {packageName: packageName})['packageDuration'];

                        dateExpire = new Date(numberDateExpire);
                        dateExpire.setDate(1);
                        dateExpire.setMonth(dateExpire.getMonth() + numberDuration);
                        dateExpire.setDate(daysInMonth(dateExpire.getMonth() + 1, dateExpire.getYear()) - 1);
                        dateExpire.setHours(23);
                        dateExpire.setMinutes(59);
                        dateExpire.setSeconds(59);

                        if (userCredits < numberPrice){
                            /*var err = new Error('Have no credits');
                            err.status = 400;
                            return next(err);*/
                            return next(badRequests.NotEnCredits());
                        }

                        //resultUser.credits -= numberPrice;



                        User.update({_id: userId, "numbers.number": number},{$set:{"numbers.$.expire":dateExpire}, $inc:{credits: -numberPrice}}, function(err, updateUser){
                      //  resultUser.save(function(err, updatedUser){
                            if (err){
                                return next(err);
                            }
                            User.findById(userId, function(err, findedUser){
                                if (err){
                                    return next(err);
                                }
                                left = lodash.findWhere(findedUser.numbers, {number: number})['left'];
                                res.status(200).send({number: number, credits: findedUser.credits, left: left});
                            });


                        });

                    } else {
                        //err = new Error('Not valid parameters');
                        //err.status = 400;
                        //next(err);
                        next(badRequests.InvalidValue({message: 'Not valid parameters'}));
                    }

                });
            }
        });
    };

    function daysInMonth (month, year) {
        return new Date(year, month, 0).getDate();
    }

    this.addNumber = function ( options, callback ) { //todo test
        var userId = options.userId;
        var userCredits;
        var numberPrice;
        var numberDuration;
        var dateExpire;
        var packageName = options.packageName;
        var findObject = {
            countryIso: options.countryIso
        };

        User.findOne({_id: userId}, function(err, resultUser){
            if (err){
                return callback( err );
            }
            userCredits = resultUser.credits;

            Price.findOne(findObject, function(err, result){
                if (err){
                    return callback( err );
                }
                if (result && result.buyNumberPackages){

                    numberPrice = lodash.findWhere(result.buyNumberPackages, {packageName: packageName})['price'];
                    numberDuration = lodash.findWhere(result.buyNumberPackages, {packageName: packageName})['packageDuration'];

                    dateExpire = new Date();
                    dateExpire.setDate(1);
                    dateExpire.setMonth(dateExpire.getMonth() + numberDuration - 1);
                    dateExpire.setDate(daysInMonth(dateExpire.getMonth() + 1, dateExpire.getYear()) - 1);
                    dateExpire.setHours(23);
                    dateExpire.setMinutes(59);
                    dateExpire.setSeconds(59);

                    if (userCredits < numberPrice){
                        //var err = new Error('Have no credits');
                        //err.status = 400;
                        //return callback(err);
                        return callback(badRequests.NotEnCredits());
                    }

                    resultUser.credits -= numberPrice;


                    var number = {
                        number: options.number,
                        countryIso: options.countryIso,
                        provider: options.provider,
                        expire: dateExpire
                    };

                    resultUser.numbers.push(number);

                    resultUser.save(function(err, updatedUser){
                        if (err){
                            return callback( err );
                        }
                        callback(null, updatedUser);
                    });
                } else {
                    err = new Error('not valid parameters');
                    err.status = 400;
                    callback(err);
                }

            });
        });



    };



    this.updateAccount = function ( req, res, next ) {
        var options = req.body;
        var userId = req.session.uId || req.params.id;
        var setObject;

        delete options.password;
        delete options.email;
        delete options.numbers;

        if( (Object.keys( options )).length ) {
            setObject = {
                $set: options
            };
        }
        updateUser( userId, setObject, function(err, updatedUser) {
            if(err){
                next(err);
            } else {
                res.status( 200 ).send( {success: 'User updated success'} );
            }
        });
    };

    this.findUserById = function ( userId, callback ) {
        User.findById( userId, function ( err, user ) {
            if( err ) {
                callback( err );
            } else {
                callback( null, user );
            }
        } );

    };

    this.getProfile = function ( req, res, next ) {
        var userId = req.session.uId;
        var projectionOtion = {
            _id: 0,
            password: 0
        };
        User.findById( userId, projectionOtion, function ( err, user ) {
            if( err ) {
                next( err );
            } else {
                res.status(200).send( {
                    success: "success returned user",
                    user: user
                });
            }
        } );

    };


    this.changePassword = function( req, res, next ) {
        var body = req.body;
        var userId = req.session.uId;
        var oldPass = body.password;
        var newPass = body.newpassword;
        var confirmPass = body.confirmnewpass;
        var shaSumOld = crypto.createHash( 'sha256' );
        var shaSumNew = crypto.createHash( 'sha256' );
        var oldPassHash;
        var newPassHash;
        var findObject;
        var setObject;
        var err;

        if ( !oldPass || !newPass || !confirmPass ) {
            //err = new Error('Require field');
            //err.status = 409;
            //return res.status( err.status ).send( { success: err.message } );
            return next(badRequests.NotEnParams());
        }

        if ( newPass !== confirmPass ) {
            //err = new Error('New passwords dont match');
            //err.status = 409;
            //return res.status( err.status ).send( { success: err.message } );
            return next(badRequests.InvalidValue({message: 'New passwords don\'t match'}));
        }

        oldPassHash = shaSumOld.update( oldPass );
        newPassHash = shaSumNew.update( newPass );

        /*if ( shaSumOld.digest( 'hex' ) === shaSumNew.digest( 'hex' ) ) {*/
        if ( oldPassHash === newPassHash ) {
            //err = new Error('New password is the same as the old');
            //err.status = 400;
            //return res.status( err.status ).send( { success: err.message } );
            return next(badRequests.InvalidValue({message: 'New password is the same as the old'}));
        }

        findObject = {
            "_id": userId,
            "password": oldPassHash
        };

        setObject = {
            $set: { password: newPassHash }
        };

        User.findOneAndUpdate( findObject, setObject, function ( err, curUser ) {

            if ( err ) {
                return next( err );
            }

            if ( !curUser ) {
                //err = new Error('Bad Password');
                //err.status = 401;
                //return next( err )
                //return res.status( err.status ).send( { success: err.message } );
                return next(badRequests.InvalidValue({message: 'Bad Password', status: 401}));
            }

            res.status( 200 ).send( {success: "password updated succefuly"} )
        });

    };

    this.getAddressBook = function ( req, res, next ) {
        var desc = (req.query.desc == 0) ? 1 : -1;
        var userId = req.session.uId;
        var limit = req.query.l || 20;
        var page = req.query.p || 1;
        var filter = req.query.q;

        var sortObj = {
            companion: desc
        };
        var queryObj = {
            refUser: newObjectId( userId )
        };
        var projObj = {
            "_id": 0,
            refUser: 0,
            "__v": 0,
            "numbers._id": 0
        };

        if ( req.query.q ) {
            queryObj.companion = new RegExp( '^' + filter, "i");
        }
        console.log( queryObj );

        AddressBook
            .find( queryObj, projObj )
            .sort( sortObj )
            .skip( page > 0 ? ( page - 1 )* limit : 0)
            .limit( limit )
            .exec( function ( err, entries ) {
                if ( err ) {
                    return next( err );
                }
                return res.status( 200 ).json( entries )
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

    this.deleteAddressBookEntry = function ( req, res, next ) {
        var companion = req.params.companion;
        var userId = req.session.uId;
        var queryObj = {
            refUser: newObjectId( userId ),
            companion: companion
        };
        var projObj = {
            select: { companion: true } //todo add for select only companion
        };

        AddressBook.findOneAndRemove( queryObj, function ( err, entry ) {
            if ( err ) {
                return next( err );
            }

            if ( entry ) {
                return res.status( 200 ).send( {success: 'contact ' + companion + ' deleted'} );
            }

            //res.status( 404).send( {success: 'contact ' + companion + ' not found'} )
            next(badRequests.NotFound({message: 'contact ' + companion + ' not found'}));
        })
    };

    this.addAddresbookEntry = function ( req, res, next ) {
        var numbers = req.body.numbers;
        var userId = req.session.uId;
        var body = req.body;
        var companion = body.companion;
        var numArr = lodash.pluck(numbers, 'number');
        var queryObj = {
            refUser: newObjectId( userId ),
            companion: companion
        };
        var projObj = {
            _id: 1
        };

        AddressBook.findOne( queryObj, projObj, function ( err, entry ) {
            if ( err ) {
                return next( err );
            }
            if ( entry ) {
                //return res.status( 409 ).send( {success: "addressBook entry " + companion + 'exist'} );
                return next(badRequests.DuplicateEntry({message: 'addressBook entry ' + companion + 'exist'}));
            }

            body.refUser = newObjectId( userId );
            getAllAddressBookNumber( userId, function ( err, allNumbers ) {
                var existNumbers;
                var newEntry;

                if ( err ) {
                    return next(err);
                }

                existNumbers = lodash.intersection( allNumbers, numArr );

                if ( existNumbers.length ) {
                    //return res.status( 409 ).send( {success: existNumbers} )
                    return next(badRequests.DuplicateEntry({message: existNumbers}));
                }

                //todo chack if undefined body.numbers generate []
                newEntry = new AddressBook( body );
                newEntry.save( function( err, entry ) {
                    if ( err ) {
                        return next( err );
                    }

                    res.status( 201 ).send( {success: "addressBook entry " + companion + 'added'} );
                } );
            });

        } );
    };

    this.updateAddresbookEntry = function ( req, res, next ) {
        var userId = req.session.uId;
        var body = req.body;
        var companion = req.params.companion;
        var queryObj = {
            refUser: newObjectId( userId ),
            companion: companion
        };
        var projObj = {
            numbers:1
        };
        var updateObj = { $set: body };

        var tasks = [];


        AddressBook.findOne( queryObj, projObj, function ( err, entry ) {
            if ( err ) {
                return next( err );
            }

            if ( ! entry ) {
                //return res.status( 403 ).send( {success: companion + ' Nnot found'} );
                return next(badRequests.NotFound({message: companion + ' was not found'}));
            }

            function numberIsOccupied ( callback ) {
                getAllAddressBookNumber( userId, function( err, allNumbers ) {
                    var existNumbers;

                    if ( err ) {
                        return callback( err );
                    }
                    existNumbers = lodash.intersection( allNumbers, numArr );

                    if ( existNumbers.length ) {
                       /* err = new Error('number exist');
                        err.status = 409;
                        return callback( err )*/
                        return callback(badRequests.DuplicateEntry({message: 'number exist'}));
                    }

                    callback( null  );

                });
            }

            function saveAddressBookAvatar( callback ) {

                function writeToLocalStorage( name, base64Avatar, callback ) {
                    var storagePath = path.join('../public/images' );
                    var imgBuffer = new Buffer( base64Avatar, 'base64' );
                    var dirName = path.join( storagePath, req.session.uId );
                    var imgName = path.join(dirName, entry._id.toString());

                    if ( fs.existsSync( storagePath ) ) {

                        err = new Error('storage not found');
                        //err.status = 404;
                        err.status = 400;

                        return callback( err );
                    }

                    fs.exists( dirName, function ( isExist ) {

                        if ( !isExist ) {

                            fs.mkdir( dirName, function ( err ) {

                                if ( err ) {
                                    return callback( err );
                                }

                                fs.writeFile( imgName, imgBuffer, function( err ) {
                                    if (err) {
                                        return next( err );
                                    }
                                    callback( null );
                                })

                            });
                        }

                        fs.writeFile(path.join(dirName, imgName) + '.jpg', imgBuffer, function(err){

                            if (err){
                                callback(err);
                            }

                        });

                    });

                }
                updateObj['$set'].avatar = avatarUrl;
                callback( null )
            }

            function updateAddressBook ( callback ) {

                AddressBook.update( {"_id": entry._id }, updateObj)
                    .exec( function( err, result ) {

                        if ( err ) {
                            return callback( err );
                        }
                        callback(null);

                    });
            }

            if ( body.numbers ) {
                tasks.push( numberIsOccupied );
            }

            if ( body.avatar ) {
                tasks.push( saveAddressBookAvatar )
            }

            tasks.push( updateAddressBook );

            async.waterfall( tasks, function( err,result ) {

                if ( err ) {
                    //return res.status(400).send(err.message);
                    return next(err);
                }
                res.status( 200 ).send({success: companion +  " updated successfully"});

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

    this.addNumberToContact = function ( req, res, next ) {
        var companion = req.body.companion;
        var numbers = req.body.numbers;
        var userId = req.session.uId;
        var numArr = lodash.pluck(numbers, 'number');

        getAllAddressBookNumber( userId, function( err, allNumbers ) {
            var existNumbers;

            if ( err ) {
                return next(err);
            }
            existNumbers = lodash.intersection( allNumbers, numArr );
            if ( existNumbers.length ) {
                //return res.status( 409 ).send( {success: existNumbers} )
                return next(badRequests.DuplicateEntry({message: existNumbers}));
            }

            AddressBook.update(
                {
                    refUser: newObjectId( userId ),
                    companion: companion
                },
                {
                    $pushAll: {
                        numbers: numbers
                    }
                }
            ).exec(
                function( err, result ) {
                    if ( err ) {
                        return next(err);
                    }
                    res.status( 200 ).send({success:"numbers addedd succefuly"})
                }
            );
        });
    };

    function getAllAddressBookNumber( userId, callback ) {
        var getNumbersAggregate;

        getNumbersAggregate = [
            {
                $match: {
                    refUser: newObjectId( userId )
                }
            },
            {
                $unwind: "$numbers"
            },
            {
                $group: {
                    "_id": "$refUser",
                    numbers:{
                        $push:"$numbers.number"
                    }
                }
            }
        ];

        AddressBook.aggregate( getNumbersAggregate )
            .exec( function (err, result) {
                if ( err ) {
                    return callback( err );
                }
                if ( ! result[0] ) {
                    result = [
                        {
                            numbers:[]
                        }
                    ];
                }
                callback( null, result[0].numbers );
            })
    }


    this.blockNumbers = function( req, res, next ) {
        var userId = req.session.uId;
        var numbers = req.body;

        function changeNumberBlock ( number, callback ) {
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
            ).exec( function ( err, result ) {
                    if ( err ) {
                        return callback( err );
                    }
                    callback(null);
                });
        }

        async.each( numbers, changeNumberBlock, function( err ){
            if ( err ) {
                return next( err )
            }
            res.status( 200 ).send( {succes: "succefuly blocked/unblocked"} );
        })
    };

    function updateContact ( userId, contactName, contactBody, callback ) {
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
                .exec( function ( err, model ) {

                    if ( err ) {

                        return callback( err );

                    } else if (!model) {

                        model = new AddressBook( );

                    } else {

                        oldNumbers =  model.toObject();
                        oldNumbers = lodash.cloneDeep( oldNumbers.numbers );

                    }

                    callback(null, model)
                });
        }

        function checkNumber ( model, callback ) {
            if ( ! contactBody.numbers ) {
                return callback( null, model );
            }
            getAllAddressBookNumber( userId, function( err, allNumbers) {
                var newNumbers = lodash.pluck( contactBody.numbers, 'number' );
                oldNumbers = lodash.pluck( oldNumbers, 'number' );
                var usedNumbers = lodash.difference( allNumbers, oldNumbers );
                var existNumbers = lodash.intersection( usedNumbers, newNumbers );

                if ( existNumbers.length ) {
                   //err = new Error('{"success": "number(s) exist"}');
                    //err.status = 409;
                    contactBody.numbers = existNumbers;
                    //return callback( err )
                    return callback(badRequests.DuplicateEntry({message: 'number(s) exist'}));
                }
                callback( null, model )
            })
        }

        function saveContact( model, callback ) {
            model.set( contactBody );
            /*model.save()
                .exec( function( err, result ) {

                    if ( err ) {
                        return callback( err );
                    }

                    callback( null );

                });*/
            model.save(function( err, result ) {

                if ( err ) {
                    return callback( err );
                }

                callback( null );

            })
        }

        function saveAvatar( model, callback ) {
            var dirPath = path.join(path.dirname( require.main.filename ), 'uploads')//path.join( 'public/images' );
            var fileName = model._id.toString() + '.jpg';
            var avatarUrl = 'user/addressbook/'+ model._id.toString()+'/avatar';
            //var userDir = userId;
            var base64File;
            var data;

            if ( ! contactBody.avatar ) {
                return callback( null, model );
            }

            base64File = contactBody.avatar;
            data = new Buffer( base64File, 'base64');

            fileStor.postFile(dirPath, fileName, data, function(err){
                if (err){
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

        async.waterfall([getContact, checkNumber, saveAvatar, saveContact], function( err ) {
            if ( err ) {
                return callback( err );
            }
            callback( null );
        })

    }

    this.updateMyContact = function ( req, res, next) {
        var userId = req.session.uId;
        var contactName = req.params.companion;
        var contactBody = req.body;
        var msg;

        updateContact(
            userId,
            contactName,
            contactBody,
            function( err ) {
                if ( err ) {
                    if ( err.status === 409 ) {
                        err.message = contactBody.numbers
                    }
                    //return res.status( err.status || 500 ).send(err.message); //todo change status and error
                    return next(err);
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

    this.getImage = function ( req, res, next ) {
        var fileName = req.params.companion + '.jpg';
        var options = {
            root: path.join( path.dirname( require.main.filename ), 'uploads' )
        };

        res.sendFile( fileName, options, function(err) {
            if (err) {
                //return res.status( 500 ).end();
                return next(err);
            }
        })
    };
};

module.exports = User;