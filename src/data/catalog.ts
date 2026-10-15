declare const __GAME_CENTER_CATALOG__: {
  total: number;
  chapters: number;
  subjects: { name: string; count: number; chapters: number }[];
};
export const catalog = __GAME_CENTER_CATALOG__;
export const number = (value: number) => value.toLocaleString("id-ID");
