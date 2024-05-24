type Scale = {
  scaleValue: (value: number, min: number, max: number) => number;
  descaleValue: (scaledValue: number, min: number, max: number) => number;
};

const LINEAR_SCALE: Scale = {
  scaleValue: (value) => value,
  descaleValue: (scaledValue) => scaledValue,
};

const BASE = 1.5;
const log = (value: number) => Math.log(value) / Math.log(BASE);

const LOGARITHMIC_SCALE: Scale = {
  scaleValue: (value, min, max) => Math.pow(BASE, log(min) + ((log(max) - log(min)) / (max - min)) * (value - min)),
  descaleValue: (scaledValue, min, max) => min + ((log(scaledValue) - log(min)) * (max - min)) / (log(max) - log(min)),
};

export {
  Scale,
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
};
