const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config');
const logger = require('../lib/logger');

function authMiddleware(req, res, next){
    const header = req.headers.authorization;
    if(!header.startsWith("Bearer ")){
        logger.error("Invalid authorization header");
        return res.status(403).json({});
    }
    const gettoken = header.split(" ");
    const token = gettoken[1];

    try {
        const decodeValue = jwt.verify(token, JWT_SECRET);

        if(decodeValue.userId){
            req.userId = decodeValue.userId;
            next();
        }else{
            logger.error("User not authenticated");
            return res.status(401).json({
                msg: "you are not authenticated"
            })
        }
    } catch (error) {
        logger.error("Error occurred while verifying token");
        return res.status(500).json({
            msg: "internal server error"
        })
    }

}

module.exports = authMiddleware;