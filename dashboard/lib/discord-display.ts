/**
 * Discord CDN URLs and display helpers (Pomelo vs legacy tags, animated assets).
 */

export function guildIconUrl(
  guildId: string,
  icon: string | null | undefined,
  size = 128
): string | null {
  if (!icon) return null;
  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    try {
      const u = new URL(icon);
      u.searchParams.set('size', String(size));
      return u.toString();
    } catch {
      return icon;
    }
  }
  const ext = icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=${size}`;
}

export function userAvatarUrl(
  userId: string,
  avatar: string | null | undefined,
  discriminator: string | null | undefined,
  size = 256
): string {
  if (avatar) {
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      try {
        const u = new URL(avatar);
        u.searchParams.set('size', String(size));
        return u.toString();
      } catch {
        return avatar;
      }
    }
    const ext = avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=${size}`;
  }
  return defaultUserAvatarUrl(userId, discriminator);
}

export function defaultUserAvatarUrl(
  discordUserId: string,
  discriminator: string | null | undefined
): string {
  const disc = discriminator ?? '0';
  const idx =
    disc === '0'
      ? Number(BigInt(discordUserId) >> BigInt(22)) % 6
      : parseInt(disc, 10) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/** Pomelo users use discriminator "0" — omit ugly "#0" in UI. */
export function isPomeloDiscriminator(discriminator: string | null | undefined): boolean {
  return !discriminator || discriminator === '0';
}

export function formatDiscordHandle(
  username: string,
  discriminator: string | null | undefined,
  globalName?: string | null
): { displayName: string; handle: string; showLegacyTag: boolean } {
  const safeUser = (username || 'user').trim();
  const gn = globalName?.trim();
  const displayName = gn || safeUser;
  const showLegacyTag = !isPomeloDiscriminator(discriminator);
  const handle = showLegacyTag ? `${safeUser}#${discriminator}` : `@${safeUser}`;
  return { displayName, handle, showLegacyTag };
}

export function discordSnowflakeToDate(snowflake: string): Date | null {
  try {
    if (!/^\d{5,}$/.test(snowflake)) return null;
    const ms = Number(BigInt(snowflake) >> BigInt(22)) + 1420070400000;
    return new Date(ms);
  } catch {
    return null;
  }
}

export function nitroLabel(premiumType: number | null | undefined): string | null {
  if (premiumType == null) return null;
  switch (premiumType) {
    case 1:
      return 'Nitro Classic';
    case 2:
      return 'Nitro';
    case 3:
      return 'Nitro Basic';
    default:
      return null;
  }
}
