/**
 * Created by Roman on 12.02.2015.
 */
var Session = function ( db ) {

    this.register = function ( req, res, options) {
        req.session.loggedIn = true;
        req.session.uId = options._id;
        req.session.login = options.email;
        res.status( 200 ).send( { success: "Login successful", uId: options._id } );
    };

    this.kill = function ( req, res, next ) {
        if(req.session) {
            req.session.destroy();
        }
        res.status(200).send({ success: "Logout successful" });
    };

    this.authenticatedUser = function ( req, res, next ) {
        if( req.session && req.session.uId && req.session.loggedIn ) {
            next();
        } else {
            var err = new Error('UnAuthorized');
            err.status = 401;
            next(err);
        }
    };

    this.isAuthenticatedUser = function ( req, res, next ) {
        if( req.session && req.session.uId && req.session.loggedIn ) {
            res.status( 200 ).send( { success: "Is authenticated", uId: req.session.uId } );
        } else {
            var err = new Error('UnAuthorized');
            err.status = 401;
            next(err);
        }
    };

};

module.exports = Session;