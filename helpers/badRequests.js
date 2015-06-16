'use strict';

var BadRequestModule = function () {
    var DEFAULT_ERROR_NAME = 'Error';
    var DEFAULT_ERROR_MESSAGE = 'error';
    var DEFAULT_ERROR_STATUS = 400;

    var NOT_ENAUGH_PARAMS = "Not enough incoming parameters.";
    var INVALID_EMAIL = "Invalid email address.";
    var EMAIL_IN_USE = 'Email in use. Please input another email address.';
    var DUPLICATE_ENTRY = 'Duplicate entry.';
    var NOT_ENOUGH_CREDITS = 'Not enough credits';

    function Errors(options) {
        //http://j-query.blogspot.com/2014/03/custom-error-objects-in-javascript.html
        Error.captureStackTrace(this);

        if (options && options.name) {
            this.name = options.name;
        } else {
            this.name = DEFAULT_ERROR_NAME;
        }

        if (options && options.message) {
            this.message = options.message;
        } else {
            this.message = DEFAULT_ERROR_MESSAGE;
        }

        if (options && options.status) {
            this.status = options.status;
        } else {
            this.status = DEFAULT_ERROR_STATUS;
        }
    }

    Errors.prototype = Object.create(Error.prototype);

    this.NotEnCredits = function( options ) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = "NotEnoughCredits";
        }

        if (!errOptions.message) {
            errOptions.message = NOT_ENOUGH_CREDITS;
        }

        if ( !errOptions.status ) {
            errOptions.status = 402;
        }

        return new Errors(errOptions);
    };

    this.NotEnParams = function(options) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = "NotEnoughIncomingParameters";
        }

        if (!errOptions.message) {
            errOptions.message = NOT_ENAUGH_PARAMS;
        }
        if (options && options.reqParams) {
            errOptions.message += 'This parameters are required: ' + options.reqParams;
        }

        return new Errors(errOptions);
    };

    this.InvalidEmail = function (options) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = "InvalidEmal";
        }
        if (!errOptions.message) {
            errOptions.message = INVALID_EMAIL;
        }

        return new Errors(errOptions);
    };

    this.EmailInUse = function(options) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'DoubledEmail';
        }
        if (!errOptions.message) {
            errOptions.message = EMAIL_IN_USE;
        }

        return new Errors(errOptions);
    };

    this.InvalidValue = function(options) {
        var errOptions;
        var errMessage;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'InvalidValue';
        }

        if (!errOptions.message) {
            errMessage = 'Invalid value';
            if (errOptions.value) {
                errMessage += " " + options.value;
            }
            if (errOptions.param) {
                errMessage += " for '" + options.param + "'";
            }
            errOptions.message = errMessage;
        }

        return new Errors(errOptions);
    };

    this.UnknownDeviceOS = function (options) {
        var errOptions;
        var errMessage;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'UnknownDeviceOS';
        }

        if (!errOptions.message) {
            errMessage = 'Unknown device OS';
            errOptions.message = errMessage;
        }

        return new Errors(errOptions);
    };

    this.NotFound = function (options) {
        var errOptions;
        var errMessage;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'NotFound';
        }
        if (!errOptions.message) {
            errMessage = "Not Found";
            if (errOptions.target) {
                errMessage += " " + errOptions.target;
            }
            if (errOptions.searchParams) {
                errMessage += " (" + errOptions.searchParams + ")";
            }
            errOptions.message = errMessage;
        }

        return new Errors(errOptions);
    };

    this.SignInError = function (options) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'SignInError';
        }
        if (!errOptions.message) {
            errOptions.message = 'Incorrect email or password';
        }
        if (!errOptions.status) {
            errOptions.status = 400;
        }

        return new Errors(errOptions);
    };

    this.DuplicateEntry = function (options) {
        var errOptions;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'DuplicateEntry';
        }
        if (!errOptions.message) {
            errOptions.message = DUPLICATE_ENTRY;
        }
        if (!errOptions.status) {
            errOptions.status = 400;
        }

        return new Errors(errOptions);
    };

    this.IncorrectProvider = function(options) {
        var errOptions;
        var errMessage;

        if (options) {
            errOptions = options;
        } else {
            errOptions = {};
        }

        if (!errOptions.name) {
            errOptions.name = 'IncorrectProvider';
        }

        if (!errOptions.message) {
            errMessage = 'Incorrect value for number\'s provider.';
            errOptions.message = errMessage;
        }

        return new Errors(errOptions);
    };

};

module.exports = new BadRequestModule();