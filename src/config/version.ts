import metadata from '../../package.json' with { type: 'json' };

/** Application identity/version is separate from download build metadata. */
export const APP_VERSION = metadata.version;
export const RELEASE_URL = `https://github.com/Dinomax2005/luno-animate/releases/tag/v${APP_VERSION}`;
