'use strict';

var config = require('../config/config');
var jwt = require('jsonwebtoken');
var request = require('request-promise');

var orderDataServiceUrl = process.env.SCAN_SERVICE_URL || 'http://localhost:6602/orders';
var configServiceUrl = process.env.CONFIG_SERVICE_URL || 'http://localhost:6610/config';
var ecmrServiceUrl = process.env.ECMR_SERVICE_URL || 'http://localhost:6603/ecmrs';
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

    var orders;
    var ecmrs;

    var promise = requestOrderInformation(freightInformation.products);
    promise.then(function (response) {
        orders = JSON.parse(response).data;
        /*
        [{
            _id: String,
            sender: Contact,
            receiver: Contact,
            goods: [{
                "productCode": String,
                "name": String,
                "amount": Number
            }]
         }]
         */
        return requestConfiguration();
    }, function (err) {
        return res.status(500).json({success: false, msg: 'Failed to get orders', error: err});
    }).then(function (response) {
        var configuration = JSON.parse(response).data;
        /*
        mainTransporter: Contact,
        autographs:{
            transporter: String
        }
        */
        ecmrs = getEcmrs(orders, configuration, freightInformation.driver);
        return requestSaveEcmrs(ecmrs);
    }, function (err) {
        return res.status(500).json({success: false, msg: 'Failed to get configuration', error: err});
    }).then(function () {
        return requestPrintCmrs();
    }, function (err) {
        return res.status(500).json({success: false, msg: 'Failed to save ecmrs', error: err});
    }).then(function () {
        return res.status(500).json({success: true, msg: 'Ecmrs have been saved and printed'});
    }, function (err) {
        return res.status(500).json({success: false, msg: 'Failed to print ecmrs', error: err});
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

const requestConfiguration = function () {
    var options = {
        url: configServiceUrl,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        }
    };
    return request(options);
};

const requestSaveEcmrs = function (ecmrs) {
    var options = {
        url: ecmrServiceUrl + '/many',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        },
        body: JSON.stringify(ecmrs)
    };
    return request.post(options);
};

const requestPrintCmrs = function (ecmrs) {
    var options = {
        url: printServiceUrl,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        },
        body: JSON.stringify(ecmrs)
    };
    return request.post(options);
};

const generateRfidToCmrServiceToken = function () {
    return 'JWT ' + jwt.sign({
        data: {role: 'rfidtocmrservice'}
    }, config.secret, {
        expiresIn: 60
    });
};

const getEcmrs = function (orders, config, driver) {
    var ecmrs = [];

    for (var i = 0; i < orders.length; i++) {
        ecmrs.push(getEcmr(orders[i], config, driver));
    }

    return ecmrs;
};

const getEcmr = function (order, config, driver) {
    return {
        driver: driver,
        setup: {
            location: config.mainTransporter.location, // Dit zou het magazijn moeten zijn in een real-world situatie
            time: new Date()
        },
        sender: order.sender,
        receiver: order.receiver,
        deliveryLocation: order.receiver.location,  // factuuradres === leveradres
        mainTransporter: config.mainTransporter,
        reception: {
            location: order.receiver.location
        },
        goods: order.goods,
        confirmedDelivery: undefined,
        autographs: {
            sender: undefined, // Zou uit ordersysteem kunnen komen... mischien.
            receiver: undefined,
            transporter: config.autographs.transporter
        }
    }
};