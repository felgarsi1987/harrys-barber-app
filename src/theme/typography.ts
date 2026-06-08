import { TextStyle } from "react-native";

export const Fonts = {
  spaceGroteskRegular:  "SpaceGrotesk_400Regular",
  spaceGroteskMedium:   "SpaceGrotesk_500Medium",
  spaceGroteskSemiBold: "SpaceGrotesk_600SemiBold",
  syneBold:             "Syne_700Bold",
  syneExtraBold:        "Syne_800ExtraBold",
  libreBaskervilleBold: "LibreBaskerville_700Bold",
} as const;

export const Typography = {
  h1: { fontFamily: Fonts.syneExtraBold,        fontSize: 28, lineHeight: 34 } as TextStyle,
  h2: { fontFamily: Fonts.syneBold,             fontSize: 22, lineHeight: 28 } as TextStyle,
  h3: { fontFamily: Fonts.syneBold,             fontSize: 18, lineHeight: 24 } as TextStyle,
  bodyLarge:  { fontFamily: Fonts.spaceGroteskMedium,   fontSize: 16, lineHeight: 24 } as TextStyle,
  body:       { fontFamily: Fonts.spaceGroteskRegular,  fontSize: 14, lineHeight: 20 } as TextStyle,
  bodySmall:  { fontFamily: Fonts.spaceGroteskRegular,  fontSize: 12, lineHeight: 18 } as TextStyle,
  label:      { fontFamily: Fonts.spaceGroteskSemiBold, fontSize: 13, lineHeight: 18 } as TextStyle,
  caption:    { fontFamily: Fonts.spaceGroteskRegular,  fontSize: 11, lineHeight: 16 } as TextStyle,
  numLarge:   { fontFamily: Fonts.libreBaskervilleBold, fontSize: 28, lineHeight: 34 } as TextStyle,
  numMedium:  { fontFamily: Fonts.libreBaskervilleBold, fontSize: 20, lineHeight: 26 } as TextStyle,
  numSmall:   { fontFamily: Fonts.libreBaskervilleBold, fontSize: 14, lineHeight: 20 } as TextStyle,
} as const;
