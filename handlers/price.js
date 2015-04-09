/**
 * Created by User on 09.04.2015.
 */
var Price = function (db) {
   // var mongoose = require('mongoose');
    var Countries = db.model('countries');

    this.getCountriesPrice = function (req, res, next) {
        var projObj = {
            '_id': 0
        };

        Countries
            .find({}, projObj)
            .exec(function(err, entries){
                if (err) {
                    return next(err);
                }
                //console.log('getting price successfully');
                return res.status(200).json(entries);
            });
    };
}

module.exports = Price;