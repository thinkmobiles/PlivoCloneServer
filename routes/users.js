var express = require( 'express' );
var router = express.Router();
var UserHandler = require('../handlers/users');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var users = new UserHandler(db);
    var session = new SessionHandler(db);


    router.put( '/:id', session.authenticatedUser, users.updateAccount );
    router.get( '/:id', session.authenticatedUser, users.getProfile );
    router.post( '/changepass', session.authenticatedUser, users.changePassword );

    return router;
};