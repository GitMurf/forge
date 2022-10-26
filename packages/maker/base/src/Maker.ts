import path from 'path';

import { ForgeArch, ForgeConfig, ForgePlatform, IForgeMaker } from '@electron-forge/shared-types';
import fs from 'fs-extra';
import which from 'which';

export type EmptyConfig = Record<string, never>;

export interface MakerOptions {
  /**
   * The directory containing the packaged Electron application
   */
  dir: string;
  /**
   * The directory you should put all your artifacts in (potentially in sub folders)
   * NOTE: this directory is not guarunteed to already exist
   */
  makeDir: string;
  /**
   * The resolved human friendly name of the project
   */
  appName: string;
  /**
   * The target platform you should make for
   */
  targetPlatform: ForgePlatform;
  /**
   * The target architecture you should make for
   */
  targetArch: ForgeArch;
  /**
   * Fully resolved forge configuration, you shouldn't really need this
   */
  forgeConfig: ForgeConfig;
  /**
   * The application's package.json file
   */
  packageJSON: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default abstract class Maker<C> implements IForgeMaker {
  public config!: C;

  public abstract name: string;

  public abstract defaultPlatforms: ForgePlatform[];

  public requiredExternalBinaries: string[] = [];

  /** @internal */
  __isElectronForgeMaker!: true;

  /**
   * @param configOrConfigFetcher - Either a configuration object for this maker or a simple method that returns such a configuration for a given target architecture
   * @param platformsToMakeOn - If you want this maker to run on platforms different from `defaultPlatforms` you can provide those platforms here
   */
  constructor(private configOrConfigFetcher: C | ((arch: ForgeArch) => C) = {} as C, protected platformsToMakeOn?: ForgePlatform[]) {
    Object.defineProperty(this, '__isElectronForgeMaker', {
      value: true,
      enumerable: false,
      configurable: false,
    });
  }

  get platforms(): ForgePlatform[] {
    if (this.platformsToMakeOn) return this.platformsToMakeOn;
    return this.defaultPlatforms;
  }

  // TODO: Remove this, it is an eye-sore and is a nasty hack to provide forge
  //       v5 style functionality in the new API
  prepareConfig(targetArch: ForgeArch): void {
    if (typeof this.configOrConfigFetcher === 'function') {
      this.config = (this.configOrConfigFetcher as unknown as (arch: ForgeArch) => C)(targetArch);
    } else {
      this.config = this.configOrConfigFetcher as C;
    }
  }

  /**
   * Makers must implement this method and return true or false indicating whether
   * this maker can be run on the current platform.  Normally this is just a process.platform
   * check but it can be a deeper check for dependencies like fake-root or other
   * required external build tools.
   *
   * If the issue is a missing dependency you should log out a HELPFUL error message
   * telling the developer exactly what is missing and if possible how to get it.
   */
  isSupportedOnCurrentPlatform(): boolean {
    if (this.isSupportedOnCurrentPlatform === Maker.prototype.isSupportedOnCurrentPlatform) {
      throw new Error(`Maker ${this.name} did not implement the isSupportedOnCurrentPlatform method`);
    }
    return true;
  }

  /**
   * Makers must implement this method and return an array of absolute paths
   * to the artifacts generated by your maker
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async make(opts: MakerOptions): Promise<string[]> {
    if (this.make === Maker.prototype.make) {
      throw new Error(`Maker ${this.name} did not implement the make method`);
    }
    return [];
  }

  /**
   * Helpers
   */

  /**
   * Ensures the directory exists and is forced to be empty.
   *
   * I.e. If the directory already exists it is deleted and recreated, this
   * is a destructive operation
   */
  async ensureDirectory(dir: string): Promise<void> {
    if (await fs.pathExists(dir)) {
      await fs.remove(dir);
    }
    return fs.mkdirs(dir);
  }

  /**
   * Ensures the path to the file exists and the file does not exist
   *
   * I.e. If the file already exists it is deleted and the path created
   */
  async ensureFile(file: string): Promise<void> {
    if (await fs.pathExists(file)) {
      await fs.remove(file);
    }
    await fs.mkdirs(path.dirname(file));
  }

  /**
   * Checks if the specified binaries exist, which are required for the maker to be used.
   */
  externalBinariesExist(): boolean {
    return this.requiredExternalBinaries.every((binary) => which.sync(binary, { nothrow: true }) !== null);
  }

  /**
   * Throws an error if any of the binaries don't exist.
   */
  ensureExternalBinariesExist(): void {
    if (!this.externalBinariesExist()) {
      throw new Error(`Cannot make for ${this.name}, the following external binaries need to be installed: ${this.requiredExternalBinaries.join(', ')}`);
    }
  }

  /**
   * Checks if the given module is installed, used for testing if optional dependencies
   * are installed or not
   */
  isInstalled(module: string): boolean {
    try {
      require(module);
      return true;
    } catch (e) {
      // Package doesn't exist -- must not be installable on this platform
      return false;
    }
  }

  /**
   * Normalize the given semver-formatted version to a 4-part dot delimited version number without
   * prerelease information for use in Windows apps.
   */
  normalizeWindowsVersion(version: string): string {
    const noPrerelease = version.replace(/-.*/, '');
    return `${noPrerelease}.0`;
  }
}

export { Maker as MakerBase };
