/**
 * Created by User on 09.04.2015.
 */
var Price = function (db) {
    // var mongoose = require('mongoose');
    var Countries = db.model('countries');

    this.getCountriesPrice = function (req, res, next) {
        var projObj = {
            '_id': 0,
            '__v': 0
        };

        Countries
            .find({}, projObj)
            .exec(function(err, entries){
                if (err) {
                    return next(err);
                }
                console.log('getting price successfully');
                return res.status(200).json(entries);
            });
    };

    this.addCountriesPrice = function(req, res, next){
        var insertObj = req.body;
        var countryName = req.body.name;
        var country;

        Countries
            .findOne(insertObj, function(err, entry){
                if (err){
                    next(err);
                }
                if (entry){
                    res.status(409).send({success: countryName + ' already exist'})
                } else {
                    country = new Countries(insertObj);
                    country
                        .save(function(err, entry){
                            if (err){
                                next(err);
                            }
                            res.status( 201 ).send( {success: countryName + ' price added'} );
                        });
                }
            });
    }

    this.deleteCountriesPrice = function (req, res, next){
        var findObj = req.body;
        var countryName = req.body.name;
        Countries
            .findOneAndRemove(findObj, function(err, doc){
                if (err){
                    next(err);
                }
                res.send({success: countryName + ' deleted'});
            });
    }
}

module.exports = Price;