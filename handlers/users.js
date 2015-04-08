/**
 * Created by Roman on 12.02.2015.
 */
var User = function ( db ) {
    var mongoose = require( 'mongoose' );
    var User = db.model( 'user' );
    var AddressBook = db.model('addressbook');
    var crypto = require( 'crypto' );
    var SessionHandler = require( './sessions' );
    var lodash = require('lodash');
    var async = require( 'async' );
    var session = new SessionHandler( db );
    var newObjectId = mongoose.Types.ObjectId;
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

    function updateAddressBook (findObject, setObject, callback) {

        User.update( findObject, setObject, function (err, user) {
            if (err) {
                callback(err);
            } else {
                callback(null, user)
            }
        })
    }

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
            err = new Error('Not all parameters is set');
            err.status = 400;
            return next(err);

        }

        shaSum.update( password );
        userBody.password = shaSum.digest( 'hex' );

        User.findOne( {email: email}, function ( err, user ) {
            if( err ) {
                next( err );
            } else if( user && user._id ) {
                res.status( 409 ).send( {success: "user exist with email " + email + 'exist'} );
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
                        res.status( 403 ).send( { success: "Wrong login or password" } );
                    }
                } else {
                    next( err );
                }
            } )
        } else {
            errorObject = new Error( "Wrong input data" );
            errorObject.status = 400;
            next( errorObject )
        }
    };

    this.addNumber = function ( options, callback ) {
        var userId = options.userId;

        var number = {
            number: options.number,
            countryIso: options.countryIso
        };

        var setObject = {
            $addToSet: {
                numbers: number
            }
        };

        var queryOptions = {
            upsert: true
        };

        updateUser( userId, setObject, queryOptions, callback );
    };

    this.updateAccount = function ( req, res, next ) {
        var options = req.body;
        var userId = req.session.uId || req.params.id;
        var setObject;

        delete options.password;
        delete options.email;

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

    /*this.addToAddressBook = function ( req, res, next ) {
        var userId = req.session.uId;
        var body = req.body;
        var companion = body.companion;
        var numbers = body.numbers;

        var setObject = {
            companion: companion,
            numbers: numbers
        };
        var findObject = {
            _id: userId
        };

        setObject = {
            $addToSet: { addressBook: setObject}
        };


        User.findOne({ _id: userId, "addressBook.companion": companion },{_id:1}, function (err, user) {
            if (user) {

                err = new Error('Contact exist');
                err.status = 409;
                return next (err);

            } else {

                updateAddressBook(findObject, setObject, function (err, result) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).send({succes:'addressbook entry added'})
                })

            }
        });
    };*/

    /*this.deleteFromAddressBook = function ( req, res, next ) {
        var userId = req.session.uId;
        var companion = req.params.companion;
        var number = req.params.number;

        var findObject = {
            _id: userId
        };
        var setObject = {};


        if (number) {
            findObject["addressBook.companion"] = companion;
            setObject = {
                $pull: {"addressBook.$.numbers": number}
            }
        } else {
            setObject = {
                $pull: { addressBook: {companion: companion}}
            }
        }

        var queryOptions = {
            upsert: true
        };
        updateAddressBook(findObject, setObject, function (err, result) {
            if (err) {
                return next(err);
            }
            res.status(200).send({succes:'addressbook entry deleted'})
        })
    };*/

    this.changePassword = function( req, res, next ) {
        var body = req.body;
        var userId = req.session.uId;
        var oldPass = body.password;
        var newPass = body.newpassword;
        var confirmPass = body.confirmnewpass;
        var shaSumOld = crypto.createHash( 'sha256' );
        var shaSumNew = crypto.createHash( 'sha256' );
        var findObject;
        var setObject;
        var err;

        if ( !oldPass || !newPass || !confirmPass ) {
            err = new Error('Require field');
            err.status = 409;

            return res.status( err.status ).send( { success: err.message } );
        }

        if ( newPass !== confirmPass ) {
            err = new Error('New passwords dont match');
            err.status = 409;

            return res.status( err.status ).send( { success: err.message } );
        }

        shaSumOld.update( oldPass );
        shaSumNew.update( newPass );

        findObject = {
            "_id": userId,
            "password": shaSumOld.digest( 'hex' )
        };

        setObject = {
            $set: { password: shaSumNew.digest( 'hex' ) }
        };

        User.findOneAndUpdate( findObject, setObject, function ( err, curUser ) {

            if ( err ) {
                return next( err );
            }

            if ( !curUser ) {
                err = new Error('Bad Password');
                err.status = 401;
                //return next( err )

                return res.status( err.status ).send( { success: err.message } );
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
            .skip( page > 0 ? ( page -1 )* limit : 0)
            .limit( limit )
            .exec( function ( err, entries ) {
                if ( err ) {
                    return next( err );
                }

                return res.status( 200 ).json( entries )
            });

    };

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

            res.status( 404).send( {success: 'contact ' + companion + ' not found'} )
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
                return res.status( 409 ).send( {success: "addressBook entry " + companion + 'exist'} );
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
                    return res.status( 409 ).send( {success: existNumbers} )
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


        AddressBook.findOne( queryObj, projObj, function ( err, entry ) {
            if ( err ) {
                return next( err );
            }

            if ( ! entry ) {
                return res.status( 403 ).send( {success: companion + ' Nnot found'} );
            }

            if ( body.numbers ) {
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
            }
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
                return res.status( 409 ).send( {success: existNumbers} )
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
                    callback;
                });
        }

        async.each( numbers, changeNumberBlock, function( err ){
            if ( err ) {
                return next( err )
            }
            res.status( 200 ).send( {succes: "succefuly blocked/unblocked"} );
        })
    }

};

module.exports = User;