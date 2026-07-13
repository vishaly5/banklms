import RivaAsrProvider from './rivaAsr.provider.js';
import { logger } from '../../config/logger.js';

const rivaProvider = new RivaAsrProvider();

const providers = {
  riva: rivaProvider,
};

export const getProvider = (name = 'riva') => {
  if (name && name !== 'riva') {
    logger.info('[ASR-FACTORY] Ignoring non-Riva ASR provider request; Riva-only mode is enabled', { requestedProvider: name });
  }
  return rivaProvider;
};

export const buildProviderChain = ({ languageHint = 'auto', detectedLanguage = 'auto', asrMode = 'Riva' } = {}) => {
  logger.info('[ASR-FACTORY] Riva-only ASR chain resolved', {
    languageHint,
    detectedLanguage,
    requestedMode: asrMode,
    providers: ['riva'],
  });
  return [providers.riva];
};
