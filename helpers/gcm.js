/**
 * Created by Roman on 30.10.2014.
 */

/* AIzaSyCon4JAMBlXEonuzKYLCO5PbOW3PjH_biU */
module.exports = (function () {
    var gcm = require( 'node-gcm' );

    var gcmClass = function ( googleApiKey ) {

        var sender = new gcm.Sender( googleApiKey );
        var message = new gcm.Message();

        function sendPush( registartionIds, msg, options) {
            var sendingMessageObject = {};

            sendingMessageObject.text = msg;


            if( options && options.payload && typeof options.payload === 'object' && Object.keys( options.payload ).length ) {
                sendingMessageObject.payload = options.payload;
            }

            if( options && options.badge ) {
                sendingMessageObject.badge = options.badge;
            }
            if( options && options.sound ) {
                sendingMessageObject.sound = options.sound;
            }

            if( options && options.from ) {
                sendingMessageObject.sender = options.from;
            }

            if( options && options.to ) {
                sendingMessageObject.receiver = options.to;
            }

            if( options.expirationDate ) {
                var now = Math.floor( Date.now() / 1000 );
                var timeToLive = options.expirationDate - now;
                if( timeToLive > 0 ) {
                    message.timeToLive = timeToLive;
                }
            }

            message.addDataWithObject( sendingMessageObject );
            console.log(message);
            sender.send( message, registartionIds, 4, function ( err, result ) {
                console.log( '*********************Result GOOGLE**************************' );
                console.dir( result );
                console.log( '*********************-AFTER RESULT-***************************' );
            } );
        }

        sender.sendPush = sendPush;
        return sender;
    };

    return gcmClass;

})();