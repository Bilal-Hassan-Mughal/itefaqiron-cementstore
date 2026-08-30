// The DigitalPersona devices package does `import 'WebSdk'` to pull in the
// global WebSdk types. At runtime we load the real `WebSdk` script via a
// <script src="/websdk.client.js"> tag in app/layout.tsx, which registers
// `window.WebSdk`. This file is just an empty module that satisfies the
// webpack resolver.
export {};
