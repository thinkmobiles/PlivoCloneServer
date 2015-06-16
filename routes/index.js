var _ = require('lodash');

module.exports = function(app, db) {
    var logWriter = require('../modules/logWriter')();
    var models = require('../models/index')(db);
    var calls = require( './calls' )(db);
    var messages = require( './messages' )(db, app);
    var endpoints = require( './endpoints' )(db);
    var numbers = require( './numbers' )(db);
    var users = require( './users' )(db);
    var prices = require('./prices')(db);
    var addressbook = require('./addressbook')(db);
    var UserHandler = require('../handlers/users');
    var SessionHandler = require('../handlers/sessions');
    var CountriesPriceHandler = require('../handlers/price');
    var session = new SessionHandler(db);
    var user = new UserHandler(db);
    var push = require('./push')(db);
    var buy = require('./buy')(db);
    var control = require('./control')( db );
    var voiceMessages = require('./voiceMessages')(db);


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
    app.use( '/price', prices );
    app.use( '/addressbook', addressbook );
    app.use( '/push', push );
    app.use( '/buy', buy );
    app.use( '/voiceMessages', voiceMessages );
    app.use('/control', control );

    /*if ( process.env.NODE_ENV === 'development' ) {
        var testRouter = require('./testRoute')( app, db ) ;
        app.use('/test', testRouter );
    };*/

    //<editor-fold desc="Deleting temporary files from NodeJS using fs">
    app.use(function (req, res, next) {
        res.on('finish', function () {
            if (req.files) {
                Object.keys(req.files).forEach(function (file) {
                    console.log(req.files[file].path);
                    fs.unlink(req.files[file].path, function (err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                });
            }
        });
        next();
    });
//</editor-fold>

    function notFound(req, res, next){
        next();
    }

    function errorHandler( err, req, res, next ) {
        var satus = err.status || 500;

        if( process.env.NODE_ENV === 'production' ) {
            if(satus === 404 || satus === 401){
                logWriter.log( '', err.message + '\n' + err.stack );
            }
            res.status( satus).send({ error: _.omit(err, 'name', 'status') });
        } else {
            if(satus !== 401) {
                logWriter.log( '', err.message + '\n' + err.stack );
            }

            res.status( satus ).send( { error: _.omit(err, 'name', 'status')/*, stack: err.stack*/ } );
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