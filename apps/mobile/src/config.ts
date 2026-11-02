import Constants from "expo-constants";
import { Platform } from "react-native";
import { serverHost } from "./server-address";

const host = serverHost(Constants.expoConfig?.hostUri, Platform.OS);
// Explicit URLs take precedence for deployed APIs. Local development follows Metro.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || `http://${host}:3000/api/v1`
).replace(/\/+$/, "");
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL || `http://${host}:5173`
).replace(/\/+$/, "");
