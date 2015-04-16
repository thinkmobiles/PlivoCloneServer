/**
 * Created by User on 16.04.2015.
 */

var express = require('express');
var router = express.Router();

var AddressBookHandler = require('../handlers/addressBook');
var SessionHandler = require('../handlers/sessions');

module.exports = function (db){
    var addressbook = new AddressBookHandler(db);
    var session = new SessionHandler(db);

    router.delete( '/:companion', session.authenticatedUser, addressbook.deleteAddressBookEntry );
    router.post( '/', session.authenticatedUser, addressbook.addAddresbookEntry );
    router.get( '/', session.authenticatedUser, addressbook.getAddressBook );
    router.put('/:companion', session.authenticatedUser, addressbook.updateMyContact);

    router.post( '/numbers', session.authenticatedUser, addressbook.addNumberToContact );
    router.put( '/numbers/block', session.authenticatedUser, addressbook.blockNumbers );
    router.get( '/:companion/avatar', addressbook.getImage );

    return router;
}