const { Logger } = require('../mainLog')

beforeEach(() => {
  // initializeCityDatabase();
});

afterEach(() => {
  // clearCityDatabase();
});

test('logLevel info', async () => {
  // expect(isCity('Vienna')).toBeTruthy();
  const logger =  Logger({ moduleName:'mappingServer', logLevel:'info'})
  logger.info('logLevel: info')
  logger.info('info displayed')
  logger.debug('debug displayed')
  // expect(err).toBe('error happens')
})

test('logLevel debug', async () => {
  // expect(isCity('Vienna')).toBeTruthy();
  const logger =  Logger({ moduleName:'mappingServer', logLevel:'debug'})
  logger.info('logLevel: debug')
  logger.info('info displayed')
  logger.debug('debug displayed')
  // expect(err).toBe('error happens')
})
