const { format, createLogger, transports } = require('winston')
const { delay } = require('./tool')

var Logger = ({ moduleName, logLevel}) => {
    let logger = createLogger({
        level: logLevel,
        format: format.combine(
            format.label({ label: `[${moduleName}]` }),
            format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
            }),
            //
            // The simple format outputs
            // `${level}: ${message} ${[Object with everything else]}`
            //
            // format.simple()
            //
            // Alternatively you could use this custom printf format if you
            // want to control where the timestamp comes in your final message.
            // Try replacing `format.simple()` above with this:
            //
            format.printf(info => `${info.timestamp} ${moduleName} ${info.level}: ${info.message}`)
        ),
        transports: [
            new transports.Console()
        ]
    })
    // logger.info('Hello there. How are you?');
    return logger
}

module.exports = {Logger}
