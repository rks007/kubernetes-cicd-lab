const express = require('express');
const app = express();
const dotenv = require('dotenv');
const morgan = require('morgan');
const logger = require('./lib/logger');
dotenv.config();

app.use(morgan('combined'));   // logs every request to stdout
app.use(express.json());

const rootRouter = require('./routes/index');

app.use('/api/v1', rootRouter);

app.get('/', (req, res) => {
    logger.info("Welcome to the blog app");
    res.send("Welcome to the blog app");
});

app.listen(3000, () => {
    logger.info("your port is listening at port 3000");
})
