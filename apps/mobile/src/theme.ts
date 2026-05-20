export const lightColors = {
  background: "#F8FAFC",
  border: "#D9E2EC",
  brand: "#2563EB",
  brandDark: "#1E3A8A",
  brandSoft: "#DBEAFE",
  muted: "#52616B",
  panel: "#FFFFFF",
  secondary: "#14B8A6",
  secondaryDark: "#0F766E",
  secondarySoft: "#CCFBF1",
  success: "#047857",
  successSoft: "#D1FAE5",
  surface: "#F8FAFC",
  text: "#102A43",
  warning: "#F59E0B",
  warningBorder: "#FDE68A",
  warningDark: "#92400E",
  warningSoft: "#FFFBEB"
};

export const darkColors = {
  background: "#0F172A",
  border: "#263244",
  brand: "#60A5FA",
  brandDark: "#BFDBFE",
  brandSoft: "#1E3A5F",
  muted: "#CBD5E1",
  panel: "#111827",
  secondary: "#2DD4BF",
  secondaryDark: "#5EEAD4",
  secondarySoft: "#123F3B",
  success: "#34D399",
  successSoft: "#113F32",
  surface: "#0F172A",
  text: "#F8FAFC",
  warning: "#FBBF24",
  warningBorder: "#92400E",
  warningDark: "#FDE68A",
  warningSoft: "#3F2A08"
};

export type ThemeMode = "light" | "dark";
export type AppColors = typeof lightColors;

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40
};
