import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.LOG_FORMAT === 'json'
      ? winston.format.json()
      : winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
