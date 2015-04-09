/**
 * Created by User on 08.04.2015.
 */

module.exports = function(db){
    'use strict'
    var mongoose = require('mongoose');
    var schema = mongoose.Schema;
    var ObjectID = schema.Types.ObjectId;
    var countriesModel;

    var countries = new schema({
        name: String,
        countryIso: String,
        setFree: Number,
        costOfNumber: Number,
        ourCharge: Number,
        store: Number,
        firstFeeTotal: Number,
        monthlyFeeTotal: Number
    }, {collection: 'Countries'});

    countriesModel = db.model('countries', countries);
};