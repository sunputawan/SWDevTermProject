const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const helmet = require('helmet');
const {xss} = require('express-xss-sanitizer');
const rateLimit =require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

// load env based on NODE_ENV (falls back to config.env)
const fs = require('fs');
const envName = process.env.NODE_ENV || 'development';
const envPath = `./config/config.${envName}.env`;
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config({ path: './config/config.env' });
}

// connect to DB
connectDB();

const auth = require('./routes/auth');
const reservations = require('./routes/reservations');
const restaurants = require('./routes/restaurants');
const reviews = require('./routes/reviews');

const app = express();


//Body express
app.set('query parser', 'extended');

app.use(express.json());
app.use(cookieParser());
app.use(mongoSanitize());
app.use(helmet());
app.use(xss());
app.use(hpp());
app.use(cors({
    origin: [
      "http://localhost:5003",
    ],
    credentials: true,
}));


//rate limiting
const limiter = rateLimit({
    windowMs: 10*60*1000, //10mins
    max: 100,
});

app.use(limiter);

app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/restaurants', restaurants);
app.use('/api/v1/reviews', reviews);


const swaggerOptions = {
    swaggerDefinition: {
        openapi: "3.0.0",
        info: {
            title: "API Library",
            version: "1.0.0",
            description: "Restaurant Reservation Backend App",
        },
        servers: [
            {
                url: "http://localhost:" + process.env.PORT + "/api/v1",
            },
        ],
        components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        },
    },
    apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

const PORT = process.env.PORT || 5003;
const server = app.listen(PORT, console.log('Server running in', process.env.NODE_ENV, 'mode on port', PORT));

process.on('unhandledRejection', (err, promise)=> {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});