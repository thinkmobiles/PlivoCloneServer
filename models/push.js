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
        deviceId: String,
        channelURI: { type: String },
        refUser: { type: ObjectID, ref: 'user', default: null },
        createdAt: {type: Date, default: Date.now},
        updatedAt: {type: Date, default: Date.now}
    }, {collection: 'Push'});
    var pushModel = db.model( 'push', push );
};
