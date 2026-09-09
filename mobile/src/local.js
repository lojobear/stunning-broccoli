import { NativeModules, Platform } from 'react-native';

const engine = NativeModules.ClarityForgeLocal;

export function hasLocalEngine() {
  return Platform.OS === 'android' && !!engine;
}

export async function processLocalImage(asset, tool, params = {}) {
  if (!engine) {
    throw new Error('The local Android processing engine is not installed in this build.');
  }
  return engine.process(asset.uri, tool, JSON.stringify(params));
}
