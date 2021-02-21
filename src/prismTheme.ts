import twConfig from "tailwind.config.js";

const twTheme = twConfig.theme;

export const theme = {
  baseColor: twTheme.colors.gray[8],
  blockBackground: twTheme.colors.gray[0],
  commentColor: twTheme.colors.gray[4],
  diffAddAccent: twTheme.colors.success[4],
  diffAddBackground: twTheme.colors.success[1],
  diffDeleteAccent: twTheme.colors.danger[4],
  diffDeleteBackground: twTheme.colors.danger[1],
  functionColor: twTheme.colors.amber[4],
  highlightAccent: twTheme.colors.warning[4],
  highlightBackground: twTheme.colors.warning[1],
  inlineCodeBackground: twTheme.colors.gray[1],
  inlineCodeColor: twTheme.colors.gray[5],
  keywordColor: twTheme.colors.amber[5],
  operatorBackground: twTheme.colors.transparent,
  operatorColor: twTheme.colors.rust[5],
  propertyColor: twTheme.colors.rust[5],
  punctuationColor: twTheme.colors.gray[7],
  selectedColor: twTheme.colors.rust[5],
  selectorColor: twTheme.colors.rust[5],
  variableColor: twTheme.colors.info[4],
};
