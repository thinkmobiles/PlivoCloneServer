/**
 * Created by eriy on 22.04.2015.
 */

module.exports = function (db){
    'use strict';
    var mongoose = require('mongoose');
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var push = new schema({
        provider : String,
        channelURI: {type: String, unique: true },
        refUser: { type: ObjectID, ref: 'user', default: null }
    }, {collection: 'Push'});
    var pushModel = db.model( 'push', push );
};
