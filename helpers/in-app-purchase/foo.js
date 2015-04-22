var fs = require('fs');
var windows = require('./windows');

fs.readFile('./xml.xml', 'utf8', function (error, xml) {
	if (error) {
		return console.error(error);
	}
	windows.validatePurchase(xml, function (error, data) {
		console.log('error?', error);
		console.log(data);
	});
});
