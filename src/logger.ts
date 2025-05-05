import winston from 'winston';

const { format, transports } = winston;
const { combine, timestamp, json, prettyPrint } = format;

// Create a logger instance
const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    // Write to all logs with level info and below to stdout
    // Write all logs error (and below) to stderr
    new transports.Console({
      format: combine(
        timestamp(),
        prettyPrint()
      )
    }),
    // Write all logs to file
    new transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Create a logger for WebSocket events
const wsLogger = logger.child({
  component: 'WebSocket'
});

// Create a logger for user events
const userLogger = logger.child({
  component: 'User'
});

// Create a logger for game events
const gameLogger = logger.child({
  component: 'Game'
});

export {
  logger,
  wsLogger,
  userLogger,
  gameLogger
};
