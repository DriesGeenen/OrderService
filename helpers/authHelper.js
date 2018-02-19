exports.printServiceRequired = function(req, res, next) {
    if (req.user) {
        next();
    } else {
        return res.status(401).json({ message: 'Unauthorized print system!' });
    }
};

exports.scanServiceRequired = function(req, res, next) {
    if (req.user && req.user.data.role === "admin") {
        next();
    } else {
        return res.status(401).json({ message: 'Unauthorized scan system!' });
    }
};
