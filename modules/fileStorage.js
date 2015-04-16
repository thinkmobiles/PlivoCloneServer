/**
 * Created by User on 16.04.2015.
 */
var fs = require('fs');
var path = require('path');

var fileStorage = function () {
    'use strict'
    this.postFile = function (folderName, fileName, options, callback) {
        var targetPath = folderName;
        var filePath = path.join(folderName, fileName);
        if (fs.existsSync(targetPath)) {
            writeFile(filePath, options.data, callback);
        } else {
            makeDir(targetPath, function (err) {
                if (err) {
                    if (callback) {
                        callback(err);
                    } else {
                        console.error('Make dir error ' + err.message);
                    }
                } else {
                    writeFile(filePath, options.data, callback);
                }
            });
        }
    };

    function writeFile(filePath, fileData, callback) {
        try {
            fs.writeFile(filePath, fileData, function (err, data) {
                if (callback && typeof callback === 'function') {
                    callback(err)
                }
            });
        }
        catch (err) {
            console.log('ERROR:', err);
            if (callback && typeof callback === 'function') {
                callback(err)
            }
        }
    };

};
module.exports =  fileStorage;
