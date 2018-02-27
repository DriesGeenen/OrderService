'use strict';

const config = require('../config/config');
const jwt = require('jsonwebtoken');
const request = require('request-promise');

const orderDataServiceUrl = process.env.SCAN_SERVICE_URL || 'http://localhost:6602/orders';
const configServiceUrl = process.env.CONFIG_SERVICE_URL || 'http://localhost:6610/config';
const ecmrServiceUrl = process.env.ECMR_SERVICE_URL || 'http://localhost:6603/ecmrs';
const printServiceUrl = process.env.PRINT_SERVICE_URL || 'http://localhost:6607/print';

exports.buildEcmr = function (req, res) {
    const freightInformation = req.body;
    /*
    driver: String,
    products: [{
        amount: Number,
        productCode: String
    }]
    */

    let orders;
    let ecmrs;
    let errors = [];

    const promise = requestOrderInformation(freightInformation.products);
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
        errors.push(err);
        //res.status(500).json({success: false, msg: 'Failed to get orders', error: err});
    }).then(function (response) {
        const configuration = (response.data !== null)? JSON.parse(response).data: {mainTransporter:{location:{}}, autographs:{}};
        /*
        mainTransporter: Contact,
        autographs:{
            transporter: String
        }
        */

        ecmrs = getEcmrs(orders, configuration, freightInformation.driver);
        return requestSaveEcmrs(ecmrs);
    }, function (err) {
        errors.push(err)
        //res.status(500).json({success: false, msg: 'Failed to get configuration', error: err});
    }).then(function () {
        return requestPrintEcmrs(ecmrs);
    }, function (err) {
        errors.push(err);
        //res.status(500).json({success: false, msg: 'Failed to save ecmrs', error: err});
    }).then(function () {
        res.json({success: true, msg: 'Ecmrs have been saved and printed (may not be true)', errors});
    }, function (err) {
        errors.push(err);
        res.json({success: false, msg: 'Print failed', errors});
    });
};

const requestOrderInformation = function (productArray) {
    const options = {
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
    const options = {
        url: configServiceUrl,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        }
    };
    return request(options);
};

const requestSaveEcmrs = function (ecmrs) {
    const options = {
        url: ecmrServiceUrl + '/many',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': generateRfidToCmrServiceToken()
        },
        body: JSON.stringify(ecmrs)
    };
    return request.post(options);
};

const requestPrintEcmrs = function (ecmrs) {
    const options = {
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
    const ecmrs = [];
    for (let i = 0; i < orders.length; i++) {
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
        deliveryLocation:{
            location: order.receiver.location
        },
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