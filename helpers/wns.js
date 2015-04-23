/**
 * Created by eriy on 12.03.2015.
 */
var wns = require( 'wns' );

module.exports = function() {

    this.sendPush = function( channelUrl, header, msg, launch, callback ) {
        var sendingMessageObject = {};
        var notificationType = 'sendToastText03';
        var connectionOptions = {
            client_id: '000000004C14EE71',
            client_secret: 'c4JJzw7O3W5ugNwayTWbsxVR7bp6XZy5',
            launch: launch
        };

        sendingMessageObject.type = notificationType;
        sendingMessageObject.text1 = header;
        sendingMessageObject.text2 = msg;

        if (! channelUrl || !( typeof(channelUrl) === 'string') ) {
            return false
        }

        wns.sendToast( channelUrl, sendingMessageObject, connectionOptions, callback );
    }

}