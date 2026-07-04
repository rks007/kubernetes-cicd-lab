const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

app.use(express.json());

const rootRouter = require('./routes/index');

app.use('/api/v1', rootRouter);

app.get('/', (req, res) => {
    res.send("Welcome to the blog app");
});

app.listen(3000, () => {
    console.log("your port is listening at port 3000");
})
