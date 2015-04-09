module.exports = function(app, db) {
    var logWriter = require('../modules/logWriter')();
    var models = require('../models/index')(db);
    var calls = require( './calls' )(db);
    var messages = require( './messages' )(db, app);
    var endpoints = require( './endpoints' )(db);
    var numbers = require( './numbers' )(db);
    var users = require( './users' )(db);
    var UserHandler = require('../handlers/users');
    var SessionHandler = require('../handlers/sessions');
    var session = new SessionHandler(db);
    var user = new UserHandler(db);

    app.get( '/', function ( req, res, next ) {
        res.status(200 ).send( 'Express start succeed' );
    } );
    app.get( '/isAuthenticated', session.isAuthenticatedUser);
    app.post( '/signIn', user.signIn);
    app.post( '/signUp', user.signUp);
    app.get( '/signOut', user.signOut);

    app.use( '/call', calls );
    app.use( '/message', messages );
    app.use( '/endpoint', endpoints );
    app.use( '/number', numbers );
    app.use( '/user', users );
    //app.use( '/addressbook', addressbook );

    function notFound(req, res, next){
        next();
    }

    function errorHandler( err, req, res, next ) {
        var satus = err.status || 500;

        if( process.env.NODE_ENV === 'production' ) {
            if(satus === 404 || satus === 401){
                logWriter.log( '', err.message + '\n' + err.stack );
            }
            res.status( satus );
        } else {
            if(satus !== 401) {
                logWriter.log( '', err.message + '\n' + err.stack );
            }
            res.status( satus ).send( err.message + '\n' + err.stack );
        }

        if(satus === 401){
            console.warn( err.message );
        } else {
            console.error(err.message);
            console.error(err.stack);
        }
    }
    app.use( notFound );
    app.use( errorHandler );
};