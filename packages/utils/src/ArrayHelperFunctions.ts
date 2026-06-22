export function ArrayHasAny(array: string[], values: string[]) {
  return values.some((value) => array.includes(value));
}
export function ArrayHasAnyModified(array: string[], values: string[]) {
  if (values.includes("*") && array.length > 0) return true;
  return values.some((value) => {
    if (value.endsWith(":*")) {
      const parent = value.slice(0, -1);
      return array.some((val) => val.startsWith(parent));
    }
    return array.includes(value);
  });
}
export function ArrayHasAll(array: string[], Values: string[]) {
  for (const value of Values) {
    if (!array.includes(value)) return false;
  }
  return true;
}

export const eqSet = (set1: Set<string>, set2: Set<string>) =>
  set1.size === set2.size && [...set1].every((x) => set1.has(x));

export const SetDifferenceES6 = (set1: Set<string>, set2: Set<string>) =>
  [...set1].filter((element) => !set2.has(element));
