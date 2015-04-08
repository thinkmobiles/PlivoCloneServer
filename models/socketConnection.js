/**
 * Created by Roman on 16.02.2015.
 */
module.exports = function ( db ) {
    "use strict";
    var mongoose = require( 'mongoose' );
    var schema = mongoose.Schema;
    var socketConnection = new schema( {
        socketId: String,
        userId: String,
        lastUpdated: {type: Date, default: Date.now}
    }, {collection: 'SocketConnection'} );
    var socketConnection = db.model( 'socketConnection', socketConnection );
};