type Scale = {
  scaleValue: (value: number, min: number, max: number) => number;
  // Generic so it preserves the caller's nullability: a numeric bound descales
  // to a `number`, while a possibly-unset slider value (`number | null`)
  // descales to `number | null` (a `null` value passes straight through).
  descaleValue: <V extends number | null>(scaledValue: V, min: number, max: number) => V;
};

const LINEAR_SCALE: Scale = {
  scaleValue: (value) => value,
  descaleValue: (scaledValue) => scaledValue,
};

const LOGARITHMIC_SCALE: Scale = {
  scaleValue: (value, min, max) => Math.exp(
    Math.log(min) + (
      (Math.log(max) - Math.log(min)) / (max - min)) * (value - min)),
  // The conditional guarantees `null in -> null out` and `number in -> number
  // out`, but TS can't prove that against the generic `V`, hence the cast.
  descaleValue: <V extends number | null>(scaledValue: V, min: number, max: number): V => (
    scaledValue === null
      ? null
      : min + (
        (Math.log(scaledValue) - Math.log(min)) * (max - min)) / (
          Math.log(max) - Math.log(min))
  ) as V,
};

export {
  Scale,
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
};
