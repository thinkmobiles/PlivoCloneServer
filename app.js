var express = require( 'express' );
var path = require( 'path' );
var logger = require( 'morgan' );
var cookieParser = require( 'cookie-parser' );
var bodyParser = require( 'body-parser' );
var mongoose = require( 'mongoose' );
var app = express();
var sockets = require( 'socket.io' );
var SchedulerHandler;
var shedule;


app.use( function(req, res, next) {
    var browser = req.headers['user-agent'];
    console.log('---------------------------------');
    console.log(browser);
    if (/Trident|NativeHost/.test(browser)) {
        res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    }
    next();
}) ;
app.use( logger( 'dev' ) );
app.use( bodyParser.json({strict: false, limit: 1024 * 1024 * 200}) );
app.use( bodyParser.urlencoded( { extended: false } ) );
app.use( cookieParser() );
app.use( express.static( path.join( __dirname, 'public' ) ) );

if( app.get( 'env' ) === 'development' ) {
    require( './config/development' );
} else {
    require( './config/production' );
}

var connectOptions = {
    //db: { native_parser: true },
    db: { native_parser: false },
    server: { poolSize: 5 },
    //replset: { rs_name: 'myReplicaSetName' },
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    w: 1,
    j: true,
    mongos: true
};

var config = {
    db: 1,
    host: process.env.REDIS_HOST,
    port: parseInt( process.env.REDIS_PORT ) || 6379
};

var mainDb = mongoose.createConnection( process.env.DB_HOST, process.env.DB_NAME, process.env.DB_PORT, connectOptions );

mainDb.on( 'error', console.error.bind( console, 'connection error:' ) );
mainDb.once( 'open', function callback() {
    console.log( "Connection to " + process.env.DB_NAME + " is success" );

    var session = require( 'express-session' );
    var MemoryStore = require( 'connect-redis' )( session );
    var SocketConnection = require('./handlers/socketConnections');
    var debug;
    var http;
    var port;
    var server;
    var io;

    app.use( session( {
        name: 'testCall',
        secret: '1q2w3e4r5tdhgkdfhgdhgdlfhgkdlgh8j0jge4547hh',
        resave: true,
        saveUninitialized: true,
        store: new MemoryStore( config )
    } ) );

    require('./routes')(app, mainDb);

    // TODO test schedule

    SchedulerHandler = require('./handlers/schedule');
    shedule = new SchedulerHandler(mainDb);
    shedule.cronJob.start();

    debug = require( 'debug' )( 'Plivo:server' );
    http = require( 'http' );
    port = parseInt( process.env.PORT) || '8830';
    server = http.createServer( app );

    io = sockets( server, {
        /*'store': new RedisSocketStore( redisObject )*/
    } );

    server.listen( port, function () {
        console.log( 'Express start on port ' + port );
    } );

    io.on('connection', function (socket) {
        var socketConnection;

        app.set('io', io);

        socketConnection = new SocketConnection(mainDb);

        socket.emit('connectedToServer', {success: 'Success'});
        socket.on('publishMessage', function (data) {
            console.log(data);
        });
        socket.on('authorize', function (data) {
            console.log('Socket:');
            console.log(data);
            data.socketId = socket.id;
            socketConnection.registerSocket(data);
        });
        socket.on('disconnect', function () {
            var data = {
                socketId: socket.id,
            };
            socketConnection.unregisterSocket( data );
            console.log('Socket disconnected' + socket.id);
        });
    });
} );

