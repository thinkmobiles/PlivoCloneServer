/**
 * Created by eriy on 12.03.2015.
 */
var wns = require( 'wns' );

module.exports = function() {
    var currentAccessToken;
    var client_id = 'ms-app://s-1-15-2-2329854933-3467371773-235525189-2707151496-3265958890-3459980472-2316457019';
    var client_secret = 'c4JJzw7O3W5ugNwayTWbsxVR7bp6XZy5';
    var notificationType = 'ToastText03';

    this.sendPush = function( channelUrl, header, msg, launch, callback ) {
        var sendingMessageObject = {};
        var connectionOptions = {
            client_id: client_id,
            client_secret: client_secret,
            accessToken: currentAccessToken,
            launch: launch
        };

        sendingMessageObject.type = notificationType;
        sendingMessageObject.text1 = header;
        sendingMessageObject.text2 = msg;

        if (! channelUrl || !( typeof(channelUrl) === 'string') ) {
            return false
        }

        wns.sendToast( channelUrl, sendingMessageObject, connectionOptions, function(err, result) {
            currentAccessToken = err ? err.newAccessToken : result.newAccessToken;
            if ( err ) {
                return callback( err.statusCode );
            }
            callback( null );
        });
    }

}