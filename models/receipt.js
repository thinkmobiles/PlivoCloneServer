/**
 * Created by User on 21.04.2015.
 */

module.exports = function (db){
    'use strict'
    var mongoose = require('mongoose');
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.objectId;
    var receipt = new schema({
        certificateId: String,
        productId: String,
        appId: String,
        date: {type: Date, default: Date.now},
        refUser: { type: ObjectID, ref: 'user', default: null },
        rawReceipt : String,
        isValidated: {type: Boolean, default: false}
    }, {collection: 'Receipts'});
    var receiptModel = db.model('receipt', receipt);
};
