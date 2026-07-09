// src/utils/responsive.ts
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const guidelineBaseWidth = 375; // design reference width

export function scaleSize(size: number) {
  return Math.round((SCREEN_WIDTH / guidelineBaseWidth) * size);
}

export function moderateScale(size: number, factor = 0.5) {
  const newSize = size + (scaleSize(size) - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };
