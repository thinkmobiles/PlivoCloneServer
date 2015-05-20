/**
 * Created by User on 17.04.2015.
 */
var mongoose = require('mongoose');
var schema = mongoose.Schema;

module.exports = function( db ){
    'use strict';
    var buyPackage = new schema( {
        name: String,
        productId: {
            windows: String,
            google: String,
            apple: String,
        },
        appId: {
            windows: String,
            google: String,
            apple: String
        },
        price: Number,
        credits: Number
    }, {
        collection: 'BuyPackage'
    } );

    var buyPackageModel = db.model('buyPackage', buyPackage );
};