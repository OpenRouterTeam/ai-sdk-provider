// Version string of this package injected at build time.
declare const __PACKAGE_VERSION__: string | undefined;
export const VERSION: string =
  __PACKAGE_VERSION__ === undefined ? '0.0.0-test' : __PACKAGE_VERSION__;
