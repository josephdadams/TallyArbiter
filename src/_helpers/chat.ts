import { Config } from '../_models/Config'

/**
 * Server-wide chat switch.
 *
 * Chat is enabled by default: a config written before this option existed has no
 * `chat_enabled` key at all, and those installs must keep working exactly as they
 * did. Only an explicit `false` turns chat off, so a missing (or otherwise
 * non-boolean) value always reads as enabled.
 *
 * Deliberately dependency-free so it can be used from anywhere without dragging
 * the server entrypoint in.
 */
export function isChatEnabled(config: Pick<Config, 'chat_enabled'> | undefined | null): boolean {
	return config?.chat_enabled !== false
}
