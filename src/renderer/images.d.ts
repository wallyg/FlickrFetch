// Lets TypeScript import picture files. This has to be its own file: env.d.ts imports types, which turns it into a module, and a
// 'declare module' inside a module does not count as a declaration for the whole app.
declare module '*.png' {
  const src: string
  export default src
}
