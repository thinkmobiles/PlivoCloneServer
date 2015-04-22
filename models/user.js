/**
 * Created by Roman on 12.02.2015.
 */
module.exports = function ( db ) {
    "use strict";
    //todo add indexes for number unique
    var mongoose = require( 'mongoose' );
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var user;
    var number = new schema({
        number: {
            type: String,
            unique: true
        },
        countryIso: {
            type: String,
            uppercase: 1
        },
        expire: { type: Date }
    }, {
        toJSON: {
            virtuals: 1
        },
        id: 0,
        _id: 0
    });

    number.virtual('left').get(function(){
        // expire = 'xxxx-xx-29|30 23:59:59 '
        var day = 1000 * 60 * 60 * 24;
        var now = new Date();
        var endDate = new Date( this.expire || now );
        //var endDate = new Date( '2016-01-01' );

        return Math.ceil( (endDate - now) / day );
    });

    user = new schema( {
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
        numbers: [ number ]
        /*conversation: [{type: ObjectID, ref: 'conversation'}]*/
    }, {collection: 'Users'} );
    var userModel = db.model( 'user', user );
};