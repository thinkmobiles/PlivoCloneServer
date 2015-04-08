/**
 * Created by eriy on 01.04.2015.
 */
module.exports = function ( db ) {
    "use strict";
    var mongoose = require( 'mongoose' );
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var addressBook = new schema( {
        companion: String,
        avatar : String,
        numbers: [{
            isBlocked: { type: Boolean, default: false },
            number: String
        }],
        refUser: { type: ObjectID, ref: 'user', default: null }
    }, {collection: 'AddressBooks'} );
    var addressBookModel = db.model( 'addressbook', addressBook );
};