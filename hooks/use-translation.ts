import { useSettings } from '@/contexts/settings-context';
import { translations } from '@/constants/translations';

type Translations = typeof translations.de;

export function useTranslation() {
  const { language, setLanguage } = useSettings();

  function t<Section extends keyof Translations>(
    section: Section,
    key: keyof Translations[Section]
  ): string {
    return translations[language][section][key] as string;
  }

  return { t, language, setLanguage };
}
