'use strict';

/**
 * Created by eriy on 12.03.2015.
 */
var wns = require('wns');

var WNS = function (clientId, clientSecret) {
    var self = this;
    var notificationType = 'ToastText03';

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = ''; //it must be a string

    //this.sendPush = function( channelUrl, header, msg, launch, callback ) {
    this.sendPush = function (channelUrl, msg, options, callback) {
        var err;
        var connectionOptions;
        var messageObject;

        if (!channelUrl || !( typeof(channelUrl) === 'string')) {
            err = new Error();
            err.message = '"channelUrl" is undefined';
            err.status = 400;

            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
            return console.error(err);
        }

        if (msg === undefined) {
            err = new Error();
            err.message = '"msg" is undefined';
            err.status = 400;

            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
            return console.error(err);
        }

        connectionOptions = {
            client_id: self.clientId,
            client_secret: self.clientSecret,
            accessToken: self.accessToken
        };

        messageObject = {
            type: (options && options.type) ? options.type : notificationType,
            text2: msg
        };

        if (options && options.launch) {
            connectionOptions.launch = options.launch;
        }

        if (options && options.header) {
            messageObject.text1 = options.header;
        }

        wns.sendToast(channelUrl, messageObject, connectionOptions, function (err, result) {
            if (err) {

                if (err.newAccessToken) {
                    self.accessToken = err.newAccessToken;
                }

                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }

            } else {

                if (callback && (typeof callback === 'function')) {
                    callback(null, result);
                }
            }
        });
    }
};

module.exports = WNS;