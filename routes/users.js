var express = require( 'express' );
var router = express.Router();
var UserHandler = require('../handlers/users');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db) {
    var users = new UserHandler(db);
    var session = new SessionHandler(db);

    //router.delete( '/addressbook/:companion/:number', session.authenticatedUser, users.deleteFromAddressBook );
    router.delete( '/addressbook/:companion', session.authenticatedUser, users.deleteAddressBookEntry );
    router.post( '/addressbook', session.authenticatedUser, users.addAddresbookEntry );
    router.get( '/addressbook', session.authenticatedUser, users.getAddressBook );

    router.get('/addressbook/:companion', session.authenticatedUser, users.getAvatar);

    router.put( '/addressbook/:companion', session.authenticatedUser, users.updateAddresbookEntry );

    router.put( '/:id', session.authenticatedUser, users.updateAccount );
    router.get( '/:id', session.authenticatedUser, users.getProfile );

    router.post( '/changepass', session.authenticatedUser, users.changePassword );

    router.post( '/addressbook/numbers', session.authenticatedUser, users.addNumberToContact );

    return router;
};