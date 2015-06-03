/**
 * Created by Roman on 12.02.2015.
 */
var CONVERSATION_TYPES = require('./../constants/conversationTypes');
module.exports = function ( db ) {
    "use strict";
    var mongoose = require( 'mongoose' );
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var converstion = new schema( {
        body: String,
        chat: String,
        show: [String],
        read: {
            type: Number,
            default: 0
        },
        type: {
            type: String,
            default: CONVERSATION_TYPES.TEXT
            /*default: "TEXT",
            match: /^TEXT$|^VOICE&/i*/
        },
        voiceURL: {
            type: String,
            default:""
        },
        owner: {
            _id: String,
            name: {
                first: String,
                last: String
            },
            number: String
        },
        companion: {
            _id: String,
            name: {
                first: String,
                last: String
            },
            number: String
        },
        postedDate: {type: Date, default: Date.now}
    }, {collection: 'Conversation'} );
    var conversationModel = db.model( 'converstion', converstion );
};