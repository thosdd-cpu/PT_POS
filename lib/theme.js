export const theme = {
  navy: "#12549E",
  navyDark: "#0C3D75",
  gold: "#ECAB67",
  goldDark: "#D98F3E",
  cream: "#F7F3E7",
  lightBlue: "#DFEDFA",
  ink: "#26313F",
  danger: "#B23A2A",
};

// Promotion boxes are always gold. Non-promo washer/dryer/addon options get
// graded colors so staff can tell them apart at a glance.
export const tempColors = {
  cold: { bg: "#D9EEFB", border: "#6FB3DA", text: "#0F5A85" },
  warm: { bg: "#FCEBC9", border: "#E3A542", text: "#8A5A11" },
  hot: { bg: "#FBDCD3", border: "#D9633E", text: "#9C3A1D" },
};

export const dryerColors = {
  "dry-small": { bg: "#D7F0E7", border: "#4FA98C", text: "#256B54" },
  "dry-large": { bg: "#BEE6D8", border: "#3B8A70", text: "#1E5943" },
};

export const addonColors = {
  10: { bg: "#EDE9FE", border: "#A78BFA", text: "#5B21B6" },
  20: { bg: "#DDD6FE", border: "#8B5CF6", text: "#4C1D95" },
  30: { bg: "#C4B5FD", border: "#7C3AED", text: "#3B1372" },
};

export const liquidColors = {
  "wash-liquid": { bg: "#FBFAF6", border: "#D8D5C8", text: "#4A473F" },
  softener: { bg: "#E4F3FC", border: "#A9D8EF", text: "#1D5C7C" },
};

export const promoColors = { bg: "#FFF3DD", border: theme.gold, text: theme.goldDark };

