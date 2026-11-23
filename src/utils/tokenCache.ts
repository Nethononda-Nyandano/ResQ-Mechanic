import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const tokenCache = {
  async getToken(key: string) {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      }
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return;
      }
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('SecureStore set item error: ', err);
      return;
    }
  },
  async clearToken(key: string) {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        return;
      }
      return SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error('SecureStore delete item error: ', err);
      return;
    }
  },
};
