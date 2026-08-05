export function createCounter(initial: number = 0) {
  let count: number = $state(initial);

  return {
    get count(): number {
      return count;
    },
    increment(): void {
      count += 1;
    },
  };
}
