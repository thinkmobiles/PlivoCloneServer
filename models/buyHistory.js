/**
 * Created by eriy on 21.04.2015.
 */

module.exports = function (db){
    'use strict';
    var mongoose = require('mongoose');
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var receipt = new schema({
        receiptId: { type: String, required: true },
        productId: String,
        appId: String,
        rawReceipt : String,
        os: String,
        isValidated: {type: Boolean, default: false},
        errMsg: {
            type: String,
            default: ''
        },
        date: {
            type: Date,
            default: Date.now
        },
        refUser: { type: ObjectID, ref: 'user', default: null }
    }, {collection: 'BuyHistory'});
    var receiptModel = db.model('buyHistory', receipt);
};