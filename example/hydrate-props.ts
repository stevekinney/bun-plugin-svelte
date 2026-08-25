// Imported by both example/hydrate.ts (server render) and
// example/hydrate-client.ts (client hydrate). A props mismatch between the
// two sides is the most common way to trigger a hydration warning, so both
// sides read from this one module instead of duplicating the values.
export const props = { name: 'Bun', initial: 3 };
