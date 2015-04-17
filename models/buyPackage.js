/**
 * Created by User on 17.04.2015.
 */

module.exports = function(db){
    'use strict'
    var mongoose = require('mongoose');
    var schema = mongoose.Schema;
    var packages = new schema({
        name: String,
        productId: {
            windows: String,
            google: String
        },
        appId: {
            windows: String,
            google: String
        },
        price: Number,
        credits: Number,
        options: []
    }, {collection: 'BuyPackage'});
    var buyPackage = db.model('packages', packages);
};