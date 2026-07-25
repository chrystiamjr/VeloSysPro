/**
 * VeloSys Pro Internationalization (i18n) Engine powered by Rosetta
 * Clean architecture: imports separate JSON locale files for pt_BR and en_US.
 */
import rosetta from 'rosetta';
import pt_BR from './locales/pt_BR.json';
import en_US from './locales/en_US.json';

export type Language = 'pt_BR' | 'en_US';

export const dict = {
  pt_BR,
  en_US,
};

export const i18n = rosetta(dict);
i18n.locale('pt_BR');
