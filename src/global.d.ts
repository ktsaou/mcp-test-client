// Global type declarations for the browser app.
// JSX namespace is provided by @types/react.

declare module '*.css';

declare module '*.svg' {
  const src: string;
  export default src;
}
