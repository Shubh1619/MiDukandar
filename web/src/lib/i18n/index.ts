export type Locale = "en" | "hi" | "mr";

export type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  en: () => import("./dictionaries/en"),
  hi: () => import("./dictionaries/hi"),
  mr: () => import("./dictionaries/mr"),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const mod = await dictionaries[locale]();
  return mod.default;
}

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
  { value: "mr", label: "मराठी" },
];

export const LOCALE_SHORT: Record<Locale, string> = {
  en: "ENG",
  hi: "हिंदी",
  mr: "मराठी",
};

export const DEFAULT_LOCALE: Locale = "en";
