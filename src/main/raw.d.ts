// Lets the main process import a text file as a string (Vite's ?raw suffix)
declare module '*.txt?raw' {
  const content: string
  export default content
}
