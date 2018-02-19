'use strict';

var config = require('../config/config');
var jwt = require('jsonwebtoken');
var request = require('request-promise');

var orderDataServiceUrl = process.env.SCAN_SERVICE_URL || 'http://localhost:6602/orders';
var printServiceUrl = process.env.PRINT_SERVICE_URL || 'http://localhost:6607/print';

exports.buildEcmr = function (req, res) {
    var freightInformation = req.body;
    /*
    driver: String,
    products: [{
        amount: Number,
        productCode: String
    }]
    */
    var promise = requestOrderInformation(freightInformation.products);
    promise.then(function (response) {
        var orders = JSON.parse(response).data;
        return res.json({success: true, data: orders});
    }, function (err) {
        return res.status(500).json({success: false, msg: 'Failed to get orders', error: err});
    });
};

const requestOrderInformation = function (productArray) {
    var options = {
        url: orderDataServiceUrl + '/byarray',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        },
        body: JSON.stringify(productArray)
    };
    return request.post(options);
};

var generateRfidToCmrServiceToken = function () {
    return 'JWT ' + jwt.sign({
        data: {role: 'rfidtocmrservice'}
    }, config.secret, {
        expiresIn: 60
    });
};