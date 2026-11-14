/**
 * Application version, injected at build time from package.json.
 *
 * `package.json` is the only place the number is written: the footer and the
 * About page both read it here, so they can never disagree.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
