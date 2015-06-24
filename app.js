var path = require( 'path' );
var cookieParser = require( 'cookie-parser' );
var bodyParser = require( 'body-parser' );
var logger = require( 'morgan' );
var express = require( 'express' );
var mongoose = require( 'mongoose' );
var sockets = require( 'socket.io' );

var app = express();

var connectOptions;
var SchedulerHandler;
var schedule;
var mainDb;

process.env.NODE_ENV = 'development';

/*Get configuration parameters*/
if ( process.env.NODE_ENV ) {
    require( './config/'+ process.env.NODE_ENV.toLowerCase() );
} else {
    process.env.NODE_ENV = 'production';
    require( './config/production' );
}

process.env.UPLOAD_DIR = path.join(path.dirname(require.main.filename), 'uploads');

/* for Windows Phone: disable agressive cash*/
app.use( function(req, res, next) {
    var browser = req.headers['user-agent'];
    console.log('---------------------------------');
    console.log(browser);
    if (/Trident|NativeHost/.test(browser)) {
        res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    }
    next();
}) ;

/*Middleware functions*/
app.use( logger( 'dev' ) );
app.use( bodyParser.json({strict: false, limit: 1024 * 1024 * 200}) );
app.use( bodyParser.urlencoded( { extended: false } ) );
app.use( cookieParser() );
app.use( express.static( path.join( __dirname, 'public' ) ) );

/* Mongoose connection options*/
connectOptions = {
    db: { native_parser: false },
    server: { poolSize: 5 },
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    w: 1,
    j: true,
    mongos: true
};

mainDb = mongoose.createConnection( process.env.DB_HOST, process.env.DB_NAME, process.env.DB_PORT, connectOptions );

mainDb.on( 'error', console.error.bind( console, 'connection error:' ) );
mainDb.once( 'open', function callback() {
    console.log(
        "Connection to database ",  process.env.DB_NAME, " is success"
    );

    var session = require( 'express-session' );
    var MemoryStore = require( 'connect-redis' )( session );
    var SocketConnection = require('./handlers/socketConnections');
    var config;
    var debug;
    var http;
    var port;
    var server;
    var io;

    config = {
        db: 1,
        host: process.env.REDIS_HOST,
        port: parseInt( process.env.REDIS_PORT ) || 6379
    };

    app.use( session( {
        name: 'testCall',
        secret: '1q2w3e4r5tdhgkdfhgdhgdlfhgkdlgh8j0jge4547hh',
        resave: true,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365
        },
        store: new MemoryStore( config )
    } ) );

    /*require('./routes')(app, mainDb);

    SchedulerHandler = require('./handlers/schedule');
    schedule = new SchedulerHandler(mainDb);
    schedule.cronJob.start();
    schedule.deleteOldMessagesJob.start();*/


    debug = require( 'debug' )( 'Plivo:server' );
    http = require( 'http' );
    port = parseInt( process.env.PORT) || '8830';
    server = http.createServer( app );

    io = sockets( server, {
        /*'store': new RedisSocketStore( redisObject )*/
        /*pingTimeout: 1000,
        destroyUpgradeTimeout: 1000*/
    } );

    server.listen( port, function () {
        console.log(
            'Express start on port ', port, '\n',
            'Enviroment: ', process.env.NODE_ENV, '\n'
        );
    } );

    app.set('io', io);

    require('./routes')(app, mainDb);

    SchedulerHandler = require('./handlers/schedule');
    schedule = new SchedulerHandler( app, mainDb );
    schedule.cronJob.start();
    schedule.deleteOldMessagesJob.start();

    io.on('connection', function (socket) {
        var socketConnection;

        if ( process.env.NODE_ENV === 'development' ) {
            console.log('Socket connected id: ', socket.id );
        }

        //app.set('io', io);

        socketConnection = new SocketConnection(mainDb);

        socket.emit('connectedToServer', {success: 'Success'});

        socket.on('authorize', function (data) {

            /*clean previous user rooms*/
            this.leaveAll();

            /*join to room identified by userId */
            this.join( data.uId );

            if ( process.env.NODE_ENV === 'development' ) {
                console.log(
                    'Socket authorize:\n' +
                    'SocketId: ', socket.id,'\n' +
                    'userId (ROOM): ', data.uId, '\n' +
                    'sockets open by user: ', io.sockets.adapter.rooms[ data.uId ], '\n'
                );
            }

            data.socketId = socket.id; //TODO remove if ROOM work
            socketConnection.registerSocket(data);  //TODO remove if ROOM work
        });

        /* leave all rooms on unAuthorize */
        socket.on( 'unAuthorize', function() {
            this.leaveAll();
        });

        socket.on('disconnect', function () {

            /* TODO test rooms -> remove*/
            var data = {
                socketId: socket.id
            };
            socketConnection.unregisterSocket( data );

            /*TODO remove*/
            if ( process.env.NODE_ENV === 'development' ) {

                console.log( 'Socket disconnected: ', socket.id );

            }

        });
    });
} );

