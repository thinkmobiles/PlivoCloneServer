/**
 * Created by Roman on 16.02.2015.
 */

var SocketConnection = function (db) {
    var SocketConnectionModel = db.model('socketConnection');
    var UserModel = db.model('user');
    //ToDo change throw new Error to ErrorHandler
    this.registerSocket = function (options, callback ) {
        var query = {
            userId: options.uId
        };
        var updatedObject = {
            socketId: options.socketId,
            userId: options.uId
        };
        var optionsObject = {upsert:true};

        SocketConnectionModel.findOneAndUpdate(query, updatedObject, optionsObject, function(err, updatedResult){
            if(err){
                console.error( new Error(err));
            } else {
                console.dir(updatedResult);
            }
        });
    };

    this.unregisterSocket = function( options ) {
        var query = {
            socketId: options.uId
        };
        SocketConnectionModel.findOneAndRemove( query, function( err, document ) {
            if ( err ) {
                console.error( new Error(err) );
            } else {
                console.dir( document );
            }
        })
    };

    this.findSocket = function ( dstNumber, callback ) {
        var respondObject = {};

        UserModel.findOne( { "numbers.number": dstNumber }, function(err, user){
            if(err){
                callback(new Error(err));
            } else if(user && user._id){
                SocketConnectionModel.find({userId: user._id}, function(err, socketConnections){
                    if(err){
                        callback(new Error(err));
                    } else if(socketConnections && socketConnections.length){
                        console.log(socketConnections.length);
                        respondObject.socketConnection = socketConnections[0];
                        respondObject.companion = user;
                        callback(null, respondObject);
                    } else {
                        err = new Error("Connection not provided. Please register socket ");
                        err.status = 400;
                        callback(err);
                    }
                });
            } else {
                callback(null, user);
            }
        });

    };

};

module.exports = SocketConnection;