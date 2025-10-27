const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cookieParser = require('cookie-parser');

// load env
dotenv.config({path: './config/config.env'});

// connect to DB
connectDB();

const auth = require('./routes/auth');
const reservations = require('./routes/reservations');
const restaurants = require('./routes/restaurants');

const app = express();


//Body express
app.set('query parser', 'extended');

app.use(express.json());
app.use(cookieParser());

app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/restaurants', restaurants);

const PORT = process.env.PORT || 5003;
const server = app.listen(PORT, console.log('Server running in', process.env.NODE_ENV, 'mode on port', PORT));

process.on('unhandledRejection', (err, promise)=> {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});