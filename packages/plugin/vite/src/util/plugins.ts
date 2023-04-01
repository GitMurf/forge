import { builtinModules } from 'node:module';

import { VitePluginBuildConfig } from '../Config';

import type { Plugin, ResolvedConfig } from 'vite';

/**
 * `electron` and Node.js built-in modules should always be externalize.
 */
export function externalBuiltins() {
  return <Plugin>{
    name: '@electron-forge/plugin-vite:external-builtins',
    config(config) {
      const nativeModules = builtinModules.filter((e) => !e.startsWith('_'));
      const builtins = ['electron', ...nativeModules, ...nativeModules.map((m) => `node:${m}`)];

      config.build ??= {};
      config.build.rollupOptions ??= {};

      let external = config.build.rollupOptions.external;
      if (Array.isArray(external) || typeof external === 'string' || external instanceof RegExp) {
        external = builtins.concat(external as string[]);
      } else if (typeof external === 'function') {
        const original = external;
        external = function (source, importer, isResolved) {
          if (builtins.includes(source)) {
            return true;
          }
          return original(source, importer, isResolved);
        };
      } else {
        external = builtins;
      }
      config.build.rollupOptions.external = external;
    },
  };
}

/**
 * Hot restart App during development for DX.
 */
export function hotRestart(options: VitePluginBuildConfig['restart']) {
  let config: ResolvedConfig;
  const restart = () => {
    // https://github.com/electron/forge/blob/v6.0.5/packages/api/core/src/api/start.ts#L204-L211
    process.stdin.emit('data', 'rs');
  };
  // Avoid first start, it's stated by forge.
  let isFirstStart = false;

  return <Plugin>{
    name: '@electron-forge/plugin-vite:hot-restart',
    configResolved(_config) {
      config = _config;
    },
    closeBundle() {
      if (config.mode === 'production') {
        // https://github.com/electron/forge/blob/v6.1.1/packages/plugin/vite/src/ViteConfig.ts#L36-L41
        return;
      }
      if (options === false) {
        return;
      }
      if (!isFirstStart) {
        isFirstStart = true;
        return;
      }
      if (typeof options === 'function') {
        // Leave it to the user to decide whether to restart.
        options({ restart });
      } else {
        restart();
      }
    },
  };
}
