const winston = require('winston');
const SwaggerExpress = require('swagger-express-mw');
const bodyParser = require('body-parser');
const yaml = require('js-yaml');
const Promise = require('bluebird');
const path = require('path');
const connectToPassport = require('./middleware/passport');
const cors = require('cors');
const models = require('./models');
const helmet = require('helmet');
const { redisClient } = require('./services/redis');

// Promisify Swagger
Promise.promisifyAll(SwaggerExpress);

module.exports = api;

let config = {
  appRoot: path.join(__dirname, '..'),
  configDir: path.join(__dirname, './config')
};

async function api(app) {
  const limiter = require('express-limiter')(app, redisClient);
  limiter({
    path: '*',
    method: 'all',
    lookup: ['connection.remoteAddress'],
    total:
      process.env.RATE_LIMIT_REQUESTS_PER_MINUTE *
      process.env.RATE_LIMIT_MINUTES_TILL_RESET,
    expire: 1000 * 60 * process.env.RATE_LIMIT_MINUTES_TILL_RESET
  });
  app.use(helmet());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(cors());
  app = connectToPassport(app);

  const swaggerExpress = await SwaggerExpress.createAsync(config);
  swaggerExpress.register(app);

  await models.Migrations.MigratePermission();
  await models.Migrations.MigrateUser();
  return app;
}
