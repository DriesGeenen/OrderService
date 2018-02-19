'use strict';

module.exports = function (app) {
    var RfidToEcmrController = require('../controllers/rfidToEcmrControlller');
    var AuthHelper = require('../helpers/authHelper');

    // todo write auth functions
    /*app.route('/rfid-to-ecmr')
        .post(AuthHelper.scanServiceRequired, RfidToEcmrController.buildEcmr);*/
    app.route('/rfid-to-ecmr')
        .post(RfidToEcmrController.buildEcmr);

};