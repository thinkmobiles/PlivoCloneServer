/**
 * Created by eriy on 17.04.2015.
 */
var iap = require('in-app-purchase');
//var xml = require('xmldom');
//var parser = xml.DOMParser;
var xml = require('xml2js');
var doc;

/*doc.documentElement.getElementsByTagName('ProductReceipt')[0].getAttribute('AppId');*/
iap.config({
    googlePublicKeyPath: ""
});
var receipts = {};
receipts.googleReceipt = {
    "orderId":"12999763169054705758.1371079406387615",
    "packageName":"com.example.app",
    "productId":"exampleSku",
    "purchaseTime":1345678900000,
    "purchaseState":0,
    "developerPayload":"bGoa+V7g/yqDXvKRqq+JTFn4uQZbPiQJo4pf9RzJ",
    "purchaseToken":"rojeslcdyyiapnqcynkjyyjh"
};

receipts.windowsReceipt =
    '<Receipt Version="1.0" ReceiptDate="2012-08-30T23:08:52Z" CertificateId="b809e47cd0110a4db043b3f73e83acd917fe1336" ReceiptDeviceId="4e362949-acc3-fe3a-e71b-89893eb4f528">' +
        '<ProductReceipt Id="6bbf4366-6fb2-8be8-7947-92fd5f683530" ProductId="Product1" PurchaseDate="2012-08-30T23:08:52Z" ExpirationDate="2012-09-02T23:08:49Z" ProductType="Durable" AppId="55428GreenlakeApps.CurrentAppSimulatorEventTest_z7q3q7z11crfr" />' +
        '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
            '<SignedInfo>' +
                '<CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />' +
                '<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />' +
                '<Reference URI="">' +
                    '<Transforms>' +
                        '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />' +
                    '</Transforms>' +
                    '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />' +
                    '<DigestValue>Uvi8jkTYd3HtpMmAMpOm94fLeqmcQ2KCrV1XmSuY1xI=</DigestValue>' +
                '</Reference>' +
            '</SignedInfo>' +
        '<SignatureValue>TT5fDET1X9nBk9/yKEJAjVASKjall3gw8u9N5Uizx4/Le9RtJtv+E9XSMjrOXK/TDicidIPLBjTbcZylYZdGPkMvAIc3/1mdLMZYJc+EXG9IsE9L74LmJ0OqGH5WjGK/UexAXxVBWDtBbDI2JLOaBevYsyy+4hLOcTXDSUA4tXwPa2Bi+BRoUTdYE2mFW7ytOJNEs3jTiHrCK6JRvTyU9lGkNDMNx9loIr+mRks+BSf70KxPtE9XCpCvXyWa/Q1JaIyZI7llCH45Dn4SKFn6L/JBw8G8xSTrZ3sBYBKOnUDbSCfc8ucQX97EyivSPURvTyImmjpsXDm2LBaEgAMADg==</SignatureValue>' +
        '</Signature>' +
    '</Receipt>';


function findPackages (err, packageInfo, callback, receipt, userId){
    if (err) {
        return callback(err);
    } else if (!packageInfo) {
        err = new Error('package not exist');
        err.status = 400;
        return callback(err);
    }
    findOptions = {
        receiptId: receiptId
    };

    user.findOne(findOptions) //todo require mongoose models
        .exec(function (err, usedReceipt) {
            if (err) {
                return callback(err);
            } else if (usedReceipt) {
                err = new Error('receipt is used');
                err.status = 400;
                return callback(err);
            }
            iaSetUp(packageInfo, receipt, userId);


        });
};

function iaSetUp (packageInfo, receipt, userId){
    iap.setup(function (err) {
        if (err) {
            return callback(err);
        }
        iap.validate(iap.WINDOWS, receipt, function (err, windowsRess) {
            var updateObj;
            if (err) {
                return callback(err);
            }
            if (!iap.isValidated(windowsRess)) {
                err = new Error('receipt is not valid');
                err.status = 400;
                return callback(err);
            }

            updateObj = {
                $inc: {
                    credits: packageInfo.credits
                },
                $push: {
                    buys: {
                        receiptId: receiptId,
                        price: packageInfo.price,
                        credits: packageInfo.credits
                    }
                }
            };

            user.findByIdAndUpdate(userId, updateObj, function (err) {
                if (err) {
                    return callback(err);
                }
                callback(null)
            })
        });
    });
};

function purchase(userId, os, receipt, callback) {
    var appId;
    var productId;
    var receiptId;
    // os = windows || android
    var parseOptions = {};
    if (os === 'windows ') {
        xml.parseString(receipt, parseOptions, function (err, parsedReceipt) {
            var findOptions;
            if (err) {
                return callback(err);
            }
            if ( !parsedReceipt.Receipt || !parsedReceipt.Receipt.ProductReceipt || !parsedReceipt.Receipt.ProductReceipt.ProductId || !parsedReceipt.Receipt.ProductReceipt.AppId || !parsedReceipt.Receipt.ProductReceipt.Id) {
                err = new Error('receipt is not valid');
                err.status = 400;
                return callback(err);
            }

            appId = parsedReceipt.Receipt.ProductReceipt.AppId;
            productId = parsedReceipt.Receipt.ProductReceipt.ProductId;
            receiptId = parsedReceipt.Receipt.ProductReceipt.Id;

            findOptions = {
                "productId.windows": productId,
                "appId.windows": appId
            };
            packages.findOne(findOptions) //todo require mongoose models
                .exec(function (err, packageInfo) {
                    if (err) {
                        return callback(err);
                    } else if (!packageInfo) {
                        err = new Error('package not exist');
                        err.status = 400;
                        return callback(err);
                    }
                    findOptions = {
                        receiptId: receiptId
                    };

                    user.findOne(findOptions) //todo require mongoose models
                        .exec(findPackages(err, packageInfo, callback, receipt, userId));

                });
        });
    } else {
        if (!receipt || !receipt.productId || !receipt.packageName || !receipt.orderId){

        }
    }


    //1 validate if productId and appId is correct
    //2 validate if receiptId is not used
    //3 validate if receipt is valid (from google or microsoft)
    //4 add credit that is binded to product
    //5 save used receipt in db
}


xml.parseString(receipts.windowsReceipt, {}, function (err, receipt) {

});
/*var appId = doc.documentElement.getElementsByTagName('ProductReceipt')[0].getAttribute('AppId');
var productId = doc.documentElement.getElementsByTagName('ProductReceipt')[0].getAttribute('ProductId');
var receiptId = doc.documentElement.getElementsByTagName('Product')[0].getAttribute('CertificateId');*/


module.exports = receipts;

