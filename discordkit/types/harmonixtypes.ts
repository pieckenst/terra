import Eris, { 
  Message, 
  TextableChannel, 
  Collection, 
  Member, 
  Role, 
  User, 
  Guild, 
  GuildChannel, 
  CommandInteraction, 
  Constants, 
  Permission, 
  Client, 
  InteractionDataOptions, 
  InteractionDataOption, 
  InteractionDataOptionWithValue, 
  ComponentInteraction, 
  ModalSubmitInteraction 
} from "eris";
import { Manager } from "erela.js";
import { ApplicationCommandOptions } from "eris";
import { Knex } from "knex";
import { Effect } from "effect";

class ConfigError {
  readonly _tag = "ConfigError";
  constructor(readonly message: string) {}
}

class TokenError {
  readonly _tag = "TokenError";
  constructor(readonly message: string) {}
}

type BotActivityType = Exclude<
  Constants["ActivityTypes"][keyof Constants["ActivityTypes"]],
  4
>;

export interface FeatureFlags {
  useDiscordJS?: boolean;
  disabledCommands: string[];
  betaCommands: string[];
  useDatabase: "sqlite" | "postgres" | "none";
}

export interface UniversalClient {
  eris?: Eris.Client;
  //discord?: Discord.Client;
}
/* DISABLE FOR NOW
export interface UniversalCollection<K, V> {
  eris?: Eris.Collection<K, V>;
  //discord?: Discord.Collection<K, V>;
}*/

export interface UniversalMessage {
  eris?: Eris.Message;
  //discord?: Discord.Message;
}

export interface UniversalTextableChannel {
  eris?: Eris.TextableChannel;
  //discord?: Discord.TextBasedChannel;
}

export interface UniversalCommandInteraction {
  eris?: Eris.CommandInteraction;
  //discord?: Discord.CommandInteraction;
}

type HarmonixOptions = {
  ownerId?: string | undefined;
  token: string;
  prefix: string;
  dirs: {
    commands: string;
    events: string;
  };
  debug: boolean;
  clientID: string;
  clientSecret: string;
  host: string;
  port: number;
  password: string;
  featureFlags?: FeatureFlags;
  database?: Knex | null;
  intents?: (keyof typeof Constants.Intents)[];
  activity?: {
    name?: string;
    type?: BotActivityType;
  };
  status?: "online" | "idle" | "dnd" | "invisible";
};

type CustomApplicationCommandOptions = Omit<
  ApplicationCommandOptions,
  "choices"
> & {
  cooldown?: Cooldown[] | undefined;
  choices?: { name: string; value: string | number }[] | undefined;
  required?: boolean;
};

/**
 * Defines the permissions for a command.
 */
export type CommandPermissions = {
  bot?: (keyof Constants["Permissions"])[];
  user?: (keyof Constants["Permissions"])[];
  roles?: {
    needed?: string[];
    denied?: string[];
  };
  channels?: {
    needed?: string[];
    denied?: string[];
  };
  custom?: (harmonix: Harmonix, context: Message | CommandInteraction) => boolean | Promise<boolean>;
};

/**
 * Defines a cooldown for a command.
 */
export type Cooldown = {
  seconds: number;
  perUser?: boolean;
};

/**
 * Represents a button component.
 */
export type Button = {
  custom_id: string;
  style: 1 | 2 | 3 | 4 | 5;
  label?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  disabled?: boolean;
  execute: (harmonix: Harmonix, interaction: CommandInteraction) => Promise<void>;
};

/**
 * Represents a select menu component.
 */
export type SelectMenu = {
  custom_id: string;
  options: { label: string; value: string; description?: string; emoji?: { id?: string; name?: string; animated?: boolean }; default?: boolean }[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  execute: (harmonix: Harmonix, interaction: CommandInteraction) => Promise<void>;
};

/**
 * Represents a modal component.
 */
export type Modal = {
  custom_id: string;
  title: string;
  components: { type: 1; components: { type: 4; custom_id: string; label: string; style: 1 | 2; min_length?: number; max_length?: number; required?: boolean; value?: string; placeholder?: string }[] }[];
  execute: (harmonix: Harmonix, interaction: CommandInteraction) => Promise<void>;
};

/**
 * Represents a context menu command.
 */
export type ContextMenu = {
  name: string;
  type: 2 | 3; // 2 for user, 3 for message
  execute: (harmonix: Harmonix, interaction: CommandInteraction) => Promise<void>;
};

type HarmonixCommand = {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  category?: string;
  ownerOnly?: boolean;
  slashCommand?: boolean;
  type?: 1 | 2 | 3; // 1 for chat input, 2 for user, 3 for message
  options?: CustomApplicationCommandOptions[];
  permissions?: CommandPermissions;
  cooldown?: Cooldown;
  beta?: boolean;
  components?: {
    buttons?: Button[];
    selectMenus?: SelectMenu[];
    modals?: Modal[];
  };
  execute: (
    harmonix: Harmonix,
    context: Message<TextableChannel> | Eris.CommandInteraction,
    args: string[] | Record<string, any>,
  ) => Promise<void>;
  onComponentInteraction?: (
    harmonix: Harmonix,
    interaction: Eris.ComponentInteraction | Eris.ModalSubmitInteraction,
  ) => Promise<void>;
};

export type HarmonixCommandConfig = Omit<HarmonixCommand, "execute" | "onComponentInteraction">;

type HarmonixEvent = {
  name: string;
  description?: string;
  once?: boolean;
  execute: (...args: any[]) => void;
};

type Harmonix = {
  client: Eris.Client;
  options: HarmonixOptions;
  commands: Collection<any>;
  slashCommands: Collection<any>; // Add this line
  events: Collection<any>;
  startTime: Date;
  manager: Manager;
};
export {
  ConfigError,
  TokenError,
  HarmonixOptions,
  HarmonixCommand,
  HarmonixEvent,
  BotActivityType,
  Harmonix,
  CustomApplicationCommandOptions,
};
