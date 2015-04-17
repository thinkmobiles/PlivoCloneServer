/**
 * Created by Roman on 12.02.2015.
 */
module.exports = function ( db ) {
    "use strict";
    var mongoose = require( 'mongoose' );
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var user = new schema( {
        email: String,
        password: String,
        mobile: String,
        avatar:String,
        credits: Number,
        enablepush: { type: Boolean, default: true },
        name: {
            first: String,
            last: String
        },
        numbers: [ {
            countryIso: String,
            number: String
        } ],
        buys: [
            {
                receiptId: String,
                price: Number,
                credits: Number,
                buyDate: {type: Date, default: Date.now}
            }
        ]
        /*conversation: [{type: ObjectID, ref: 'conversation'}]*/
    }, {collection: 'Users'} );
    var userModel = db.model( 'user', user );
};