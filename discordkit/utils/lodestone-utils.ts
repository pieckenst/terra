import {
  JobData,
  ClassJob,
  Experience,
  ClassJobLevel,
  ClassLevel,
  Race,
  Clan,
  CharacterInfo,
  JobIconMapping,
} from "../../src/typedefinitions/lodestonetypes";
import axios from "axios";
import * as cheerio from "cheerio";

import { LogLevel, centralLogger } from "./centralloggingfactory";
import {
  logInfo,
  logSuccess,
  logWarn,
  logError,
  logDebug,
} from "./centralloggingfactory";

function getJobNameFromIcon(iconUrl: string): string {
  logInfo(`Getting job name from icon URL: ${iconUrl}`, "lodestone-utils");
  const jobIconMapping: Record<string, string> = {
    // Tanks
    "https://img.finalfantasyxiv.com/lds/h/U/F5JzG9RPIKFSogtaKNBk455aYA.png": "Gladiator",
    "https://img.finalfantasyxiv.com/lds/h/E/d0Tx-vhnsMYfYpGe9MvslemEfg.png": "Paladin",
    "https://img.finalfantasyxiv.com/lds/h/y/A3UhbjZvDeN3tf_6nJ85VP0RY0.png": "Warrior",
    "https://img.finalfantasyxiv.com/lds/h/N/St9rjDJB3xNKGYg-vwooZ4j6CM.png": "Marauder",
    "https://img.finalfantasyxiv.com/lds/h/l/5CZEvDOMYMyVn2td9LZigsgw9s.png": "Dark Knight",
    "https://img.finalfantasyxiv.com/lds/h/8/hg8ofSSOKzqng290No55trV4mI.png": "Gunbreaker",
    // Healers
    "https://img.finalfantasyxiv.com/lds/h/s/gl62VOTBJrm7D_BmAZITngUEM8.png": "Conjurer",
    "https://img.finalfantasyxiv.com/lds/h/7/i20QvSPcSQTybykLZDbQCgPwMw.png": "White Mage",
    "https://img.finalfantasyxiv.com/lds/h/7/WdFey0jyHn9Nnt1Qnm-J3yTg5s.png": "Scholar",
    "https://img.finalfantasyxiv.com/lds/h/1/erCgjnMSiab4LiHpWxVc-tXAqk.png": "Astrologian",
    "https://img.finalfantasyxiv.com/lds/h/C/bBVQ9IFeXqjEdpuIxmKvSkqalE.png": "Sage",
    // Melee DPS
    "https://img.finalfantasyxiv.com/lds/h/V/iW7IBKQ7oglB9jmbn6LwdZXkWw.png": "Pugilist",
    "https://img.finalfantasyxiv.com/lds/h/K/HW6tKOg4SOJbL8Z20GnsAWNjjM.png": "Monk",
    "https://img.finalfantasyxiv.com/lds/h/k/tYTpoSwFLuGYGDJMff8GEFuDQs.png": "Lancer",
    "https://img.finalfantasyxiv.com/lds/h/m/gX4OgBIHw68UcMU79P7LYCpldA.png": "Dragoon",
    "https://img.finalfantasyxiv.com/lds/h/y/wdwVVcptybfgSruoh8R344y_GA.png": "Rogue",
    "https://img.finalfantasyxiv.com/lds/h/0/Fso5hanZVEEAaZ7OGWJsXpf3jw.png": "Ninja",
    "https://img.finalfantasyxiv.com/lds/h/m/KndG72XtCFwaq1I1iqwcmO_0zc.png": "Samurai",
    "https://img.finalfantasyxiv.com/lds/h/_/kLob-U-yh652LQPX1NHpLlUYQY.png": "Reaper",
    "https://img.finalfantasyxiv.com/lds/h/G/Rq5wcK3IPEaAB8N-T9l6tBPxCY.png": "Viper",
    // Physical Ranged DPS
    "https://img.finalfantasyxiv.com/lds/h/Q/ZpqEJWYHj9SvHGuV9cIyRNnIkk.png": "Archer",
    "https://img.finalfantasyxiv.com/lds/h/F/KWI-9P3RX_Ojjn_mwCS2N0-3TI.png": "Bard",
    "https://img.finalfantasyxiv.com/lds/h/E/vmtbIlf6Uv8rVp2YFCWA25X0dc.png": "Machinist",
    "https://img.finalfantasyxiv.com/lds/h/t/HK0jQ1y7YV9qm30cxGOVev6Cck.png": "Dancer",
    // Magical Ranged DPS
    "https://img.finalfantasyxiv.com/lds/h/4/IM3PoP6p06GqEyReygdhZNh7fU.png": "Thaumaturge",
    "https://img.finalfantasyxiv.com/lds/h/P/V01m8YRBYcIs5vgbRtpDiqltSE.png": "Black Mage",
    "https://img.finalfantasyxiv.com/lds/h/e/VYP1LKTDpt8uJVvUT7OKrXNL9E.png": "Arcanist",
    "https://img.finalfantasyxiv.com/lds/h/h/4ghjpyyuNelzw1Bl0sM_PBA_FE.png": "Summoner",
    "https://img.finalfantasyxiv.com/lds/h/q/s3MlLUKmRAHy0pH57PnFStHmIw.png": "Red Mage",
    "https://img.finalfantasyxiv.com/lds/h/g/_oYApASVVReLLmsokuCJGkEpk0.png": "Pictomancer",
    "https://img.finalfantasyxiv.com/lds/h/p/jdV3RRKtWzgo226CC09vjen5sk.png": "Blue Mage",
    // Limited Jobs
    // Icon ID fallbacks (for when only the ID portion is available)
    HW6tKOg4SOJbL8Z20GnsAWNjjM: "Monk",
    A3UhbjZvDeN3tf_6nJ85VP0RY0: "Warrior",
    i20QvSPcSQTybykLZDbQCgPwMw: "White Mage",
    "d0Tx-vhnsMYfYpGe9MvslemEfg": "Paladin",
    "5CZEvDOMYMyVn2td9LZigsgw9s": "Dark Knight",
    hg8ofSSOKzqng290No55trV4mI: "Gunbreaker",
    "gl62VOTBJrm7D_BmAZITngUEM8": "Conjurer",
    WdFey0jyHn9Nnt1Qnm_J3yTg5s: "Scholar",
    erCgjnMSiab4LiHpWxVc_tXAqk: "Astrologian",
    bBVQ9IFeXqjEdpuIxmKvSkqalE: "Sage",
    tYTpoSwFLuGYGDJMff8GEFuDQs: "Lancer",
    gX4OgBIHw68UcMU79P7LYCpldA: "Dragoon",
    wdwVVcptybfgSruoh8R344y_GA: "Rogue",
    Fso5hanZVEEAaZ7OGWJsXpf3jw: "Ninja",
    KndG72XtCFwaq1I1iqwcmO_0zc: "Samurai",
    kLob_U_yh652LQPX1NHpLlUYQY: "Reaper",
    Rq5wcK3IPEaAB8N_T9l6tBPxCY: "Viper",
    ZpqEJWYHj9SvHGuV9cIyRNnIkk: "Archer",
    KWI_9P3RX_Ojjn_mwCS2N0_3TI: "Bard",
    vmtbIlf6Uv8rVp2YFCWA25X0dc: "Machinist",
    HK0jQ1y7YV9qm30cxGOVev6Cck: "Dancer",
    IM3PoP6p06GqEyReygdhZNh7fU: "Thaumaturge",
    V01m8YRBYcIs5vgbRtpDiqltSE: "Black Mage",
    VYP1LKTDpt8uJVvUT7OKrXNL9E: "Arcanist",
    "4ghjpyyuNelzw1Bl0sM_PBA_FE": "Summoner",
    s3MlLUKmRAHy0pH57PnFStHmIw: "Red Mage",
    _oYApASVVReLLmsokuCJGkEpk0: "Pictomancer",
    jdV3RRKtWzgo226CC09vjen5sk: "Blue Mage",
  };

  logInfo(
    `Job icon mapping: ${JSON.stringify(jobIconMapping)}`,
    "lodestone-utils",
  );

  const iconId = iconUrl.split("/").pop()?.split(".")[0];
  logInfo(`Extracted icon ID: ${iconId}`, "lodestone-utils");

  const jobName =
    jobIconMapping[iconUrl] || jobIconMapping[iconId || ""] || "Unknown";
  logInfo(`Resolved job name: ${jobName}`, "lodestone-utils");

  return jobName;
}

// Mapping of race names to their possible clan names
const RACE_CLAN_MAP: Record<string, { race: Race; clans: Record<string, Clan> }> = {
  "hyur": { race: Race.Hyur, clans: { "midlander": Clan.Midlander, "highlander": Clan.Highlander } },
  "elezen": { race: Race.Elezen, clans: { "wildwood": Clan.Wildwood, "duskwight": Clan.Duskwight } },
  "lalafell": { race: Race.Lalafell, clans: { "plainsfolk": Clan.Plainsfolk, "dunesfolk": Clan.Dunesfolk } },
  "miqo'te": { race: Race.Miqote, clans: { "seeker of the sun": Clan.SeekerOfTheSun, "keeper of the moon": Clan.KeeperOfTheMoon } },
  "roegadyn": { race: Race.Roegadyn, clans: { "sea wolf": Clan.SeaWolf, "hellsguard": Clan.Hellsguard } },
  "au ra": { race: Race.AuRa, clans: { "raen": Clan.Raen, "xaela": Clan.Xaela } },
  "viera": { race: Race.Viera, clans: { "rava": Clan.Rava, "veena": Clan.Veena } },
  "hrothgar": { race: Race.Hrothgar, clans: { "helion": Clan.Helion, "lost": Clan.Lost, "the lost": Clan.Lost } },
};

function parseRaceAndClan($: cheerio.CheerioAPI): { race: Race; clan: Clan } {
  logInfo("Parsing race, clan, and gender", "lodestone-utils");
  
  // Try multiple methods to find the race/clan text
  let raceClanText = "";
  
  // Method 1: Look for the character-block that contains Race/Clan/Gender info
  const characterBlocks = $(".character-block");
  characterBlocks.each((_, block) => {
    const blockTitle = $(block).find(".character-block__title").text().trim();
    if (blockTitle.toLowerCase().includes("race") || blockTitle.toLowerCase().includes("clan")) {
      const blockName = $(block).find(".character-block__name");
      raceClanText = blockName.text().trim();
      logInfo(`Found race/clan block with text: "${raceClanText}"`, "lodestone-utils");
      return false; // Break the loop
    }
  });
  
  // Method 2: Fallback to original method if not found
  if (!raceClanText) {
    const charBlock = $(".character-block__name").first();
    const html = charBlock.html() || "";
    
    // Try to extract from HTML structure (split by <br>)
    const parts = html.split("<br>");
    if (parts.length >= 2) {
      // The race/clan is typically in the second part, clean HTML tags
      raceClanText = parts[1]?.replace(/<[^>]*>/g, "").trim() || "";
    }
    
    if (!raceClanText) {
      raceClanText = charBlock.text().trim();
    }
    logInfo(`Fallback method extracted: "${raceClanText}"`, "lodestone-utils");
  }
  
  // Remove gender symbol if present (♀ or ♂)
  raceClanText = raceClanText.replace(/[♀♂]/g, "").trim();
  
  // Split by "/" to separate clan from gender if present (e.g., "VieraRava / ♀")
  if (raceClanText.includes("/")) {
    const parts = raceClanText.split("/");
    raceClanText = parts[0].trim();
  }
  
  logInfo(`Parsing race/clan from: "${raceClanText}"`, "lodestone-utils");
  
  // Now parse the race and clan from the combined text
  // The format is typically "RaceClan" concatenated (e.g., "VieraRava", "HyurMidlander", "LalafellDunesfolk")
  let race: Race | null = null;
  let clan: Clan | null = null;
  
  const lowerText = raceClanText.toLowerCase().trim();
  
  // Try to match race and clan from the text
  for (const [raceName, raceData] of Object.entries(RACE_CLAN_MAP)) {
    if (lowerText.startsWith(raceName) || lowerText.includes(raceName)) {
      race = raceData.race;
      
      // Now find the clan - it should be after the race name in the text
      let remainingText = lowerText.replace(raceName, "").trim();
      
      // Try each clan for this race
      for (const [clanName, clanValue] of Object.entries(raceData.clans)) {
        if (remainingText.includes(clanName) || lowerText.includes(clanName)) {
          clan = clanValue;
          logInfo(`Matched clan: ${clanName}`, "lodestone-utils");
          break;
        }
      }
      
      if (clan !== null) break;
    }
  }
  
  // If we still haven't found a match, try a more aggressive approach
  if (race === null) {
    // Check for each race individually
    for (const [raceName, raceData] of Object.entries(RACE_CLAN_MAP)) {
      if (lowerText.includes(raceName)) {
        race = raceData.race;
        
        // Find clan
        for (const [clanName, clanValue] of Object.entries(raceData.clans)) {
          if (lowerText.includes(clanName)) {
            clan = clanValue;
            break;
          }
        }
        
        if (clan === null) {
          // Default to first clan if we found a race but not a clan
          clan = Object.values(raceData.clans)[0];
          logWarn(`Found race but not clan, defaulting to: ${Object.keys(raceData.clans)[0]}`, "lodestone-utils");
        }
        break;
      }
    }
  }
  
  if (race === null) {
    logWarn(`Could not parse race from: "${raceClanText}", defaulting to Hyur`, "lodestone-utils");
    race = Race.Hyur; // Default fallback
  }
  if (clan === null) {
    logWarn(`Could not parse clan from: "${raceClanText}", defaulting to Midlander`, "lodestone-utils");
    clan = Clan.Midlander; // Default fallback
  }
  
  logInfo(`Parsed race: ${Race[race]}, clan: ${Clan[clan]}`, "lodestone-utils");
  return { race, clan };
}

async function scrapeCharacterClassJob(
  id: string,
): Promise<
  Partial<
    Record<
      ClassJob,
      ClassJobLevel & { categoryname?: string; jobname?: string }
    >
  >
> {
  const url = `https://na.finalfantasyxiv.com/lodestone/character/${id}/class_job/`;
  logInfo(
    `Scraping character class/job data from URL: ${url}`,
    "lodestone-utils",
  );

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const classLevels: Partial<
    Record<
      ClassJob,
      ClassJobLevel & { categoryname?: string; jobname?: string }
    >
  > = {};
  const tankJobs: JobData[] = [];
  const healerJobs: JobData[] = [];
  const meleeDpsJobs: JobData[] = [];
  const physicalRangedDpsJobs: JobData[] = [];
  const magicalRangedDpsJobs: JobData[] = [];
  const handJobs: JobData[] = [];
  const landJobs: JobData[] = [];

  $(".character__content.selected .character__job__role").each(
    (_, roleElement) => {
      const roleName = $(roleElement).find(".heading--lead").text().trim();
      logInfo(`Processing role: ${roleName}`, "lodestone-utils");

      $(roleElement)
        .find(".character__job li")
        .each((_, jobElement) => {
          const jobName = $(jobElement)
            .find(".character__job__name")
            .text()
            .trim();
          const level = parseInt(
            $(jobElement).find(".character__job__level").text().trim(),
            10,
          );
          const expElement = $(jobElement).find(".character__job__exp");
          let currentExp = 0;
          let expToNextLevel = 0;

          if (expElement.text().trim() !== "-- / --") {
            [currentExp, expToNextLevel] = expElement
              .text()
              .trim()
              .split("/")
              .map((exp) => parseInt(exp.replace(/,/g, "").trim(), 10));
          }

          const jobData = {
            name: jobName,
            level,
            experience:
              currentExp === 0 && expToNextLevel === 0
                ? null
                : { currentExp, expToNextLevel },
          };

          logInfo(
            `Processed job: ${jobName}, Level: ${level}, Exp: ${currentExp}/${expToNextLevel}`,
            "lodestone-utils",
          );

          const physicalRangedJobs = ["Archer", "Bard", "Machinist", "Dancer"];
          const magicalRangedJobs = [
            "Thaumaturge",
            "Black Mage",
            "Arcanist",
            "Summoner",
            "Red Mage",
            "Pictomancer",
            "Blue Mage",
          ];

          if (physicalRangedJobs.includes(jobName)) {
            physicalRangedDpsJobs.push(jobData);
          } else if (magicalRangedJobs.includes(jobName)) {
            magicalRangedDpsJobs.push(jobData);
          } else {
            switch (roleName) {
              case "Tank":
                tankJobs.push(jobData);
                break;
              case "Healer":
                healerJobs.push(jobData);
                break;
              case "Melee DPS":
                meleeDpsJobs.push(jobData);
                break;
              case "Physical Ranged DPS":
                physicalRangedDpsJobs.push(jobData);
                break;
              case "Magical Ranged DPS":
                magicalRangedDpsJobs.push(jobData);
                break;
              case "Disciples of the Hand":
                handJobs.push(jobData);
                break;
              case "Disciples of the Land":
                landJobs.push(jobData);
                break;
            }
          }
        });
    },
  );
  const processJobs = (
    jobs: JobData[],
    rolePrefix: string,
    classLevels: Partial<
      Record<
        ClassJob,
        ClassJobLevel & { categoryname?: string; jobname?: string }
      >
    >,
  ) => {
    logInfo(`--- Processing ${rolePrefix} jobs ---`, "lodestone-utils");
    jobs.forEach((job) => {
      const formattedJobName = job.name.toUpperCase().replace(/\s+/g, "_");
      logInfo(`Processing job: ${formattedJobName}`, "lodestone-utils");

      // Convert job name to ClassJob enum
      const classJobKey = ClassJob[formattedJobName as keyof typeof ClassJob];

      if (classJobKey !== undefined) {
        classLevels[classJobKey] = {
          level: job.level,
          experience: job.experience,
          categoryname: rolePrefix,
          jobname: job.name,
        };
        logInfo(
          `Added job to classLevels: ${formattedJobName}`,
          "lodestone-utils",
        );
      } else {
        logWarn(`Unknown job: ${formattedJobName}`, "lodestone-utils");
      }
    });
  };

  // Update the function calls
  processJobs(tankJobs, "TANK", classLevels);
  processJobs(healerJobs, "HEALER", classLevels);
  processJobs(meleeDpsJobs, "MELEE_DPS", classLevels);
  processJobs(physicalRangedDpsJobs, "PHYSICAL_RANGED_DPS", classLevels);
  processJobs(magicalRangedDpsJobs, "MAGICAL_RANGED_DPS", classLevels);
  processJobs(handJobs, "DISCIPLE_OF_THE_HAND", classLevels);
  processJobs(landJobs, "DISCIPLE_OF_THE_LAND", classLevels);

  logInfo("--- Processing Special Jobs ---", "lodestone-utils");

  // Handle Bozjan Southern Front
  const bozjaElement = $('.character__job__list:contains("Resistance Rank")');
  if (bozjaElement.length) {
    const bozjaLevel = parseInt(
      bozjaElement.find(".character__job__level").text().trim(),
      10,
    );
    const bozjaExp = bozjaElement
      .find(".character__job__exp")
      .text()
      .trim()
      .match(/Current Mettle: ([\d,]+) \/ Mettle to Next Rank: ([\d,]+)/);
    if (bozjaExp) {
      classLevels[ClassJob.BOZJAN] = {
        level: bozjaLevel,
        experience: {
          currentExp: parseInt(bozjaExp[1].replace(/,/g, ""), 10),
          expToNextLevel: parseInt(bozjaExp[2].replace(/,/g, ""), 10),
        },
        categoryname: "SPECIAL",
        jobname: "Bozjan Southern Front",
      };
      logInfo(
        `Processed Bozjan Southern Front - Resistance Rank: ${bozjaLevel}, Mettle: ${bozjaExp[1]}/${bozjaExp[2]}`,
        "lodestone-utils",
      );
    }
  }

  // Handle Eureka
  const eurekaElement = $('.character__job__list:contains("Elemental Level")');
  if (eurekaElement.length) {
    const eurekaLevel = parseInt(
      eurekaElement.find(".character__job__level").text().trim(),
      10,
    );
    const eurekaExp = eurekaElement
      .find(".character__job__exp")
      .text()
      .trim()
      .split("/")
      .map((exp) => parseInt(exp.replace(/,/g, "").trim(), 10));
    classLevels[ClassJob.EUREKA] = {
      level: eurekaLevel,
      experience: {
        currentExp: eurekaExp[0],
        expToNextLevel: eurekaExp[1],
      },
      categoryname: "SPECIAL",
      jobname: "Eureka",
    };
    logInfo(
      `Processed Eureka - Elemental Level: ${eurekaLevel}, Exp: ${eurekaExp[0]}/${eurekaExp[1]}`,
      "lodestone-utils",
    );
  }

  if (Object.keys(classLevels).length === 0) {
    logWarn("No classes or jobs found for this character.", "lodestone-utils");
  }

  logInfo("Finished scraping character class/job data", "lodestone-utils");
  return classLevels;
}

async function getLodestoneCharacterClassJob(
  id: string,
): Promise<
  Partial<
    Record<
      ClassJob,
      ClassJobLevel & { categoryname?: string; jobname?: string }
    >
  >
> {
  logInfo(
    `Getting Lodestone character class/job data for ID: ${id}`,
    "lodestone-utils",
  );
  try {
    const result = await scrapeCharacterClassJob(id);
    logInfo(
      "Successfully retrieved character class/job data",
      "lodestone-utils",
    );
    return result;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error(`Character with ID ${id} not found on The Lodestone.`);
    }

    throw new Error(
      "An error occurred while fetching character information from The Lodestone.",
    );
  }
}

async function fetchCharacterInfo(id: string): Promise<CharacterInfo> {
  const url = `https://na.finalfantasyxiv.com/lodestone/character/${id}/`;
  logInfo(`Fetching character info from URL: ${url}`, "lodestone-utils");
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  logInfo("Parsing basic info", "lodestone-utils");
  const basicInfo = parseBasicInfo($);
  logInfo("Parsing server info", "lodestone-utils");
  const serverInfo = parseServerInfo($);
  logInfo("Parsing character details", "lodestone-utils");
  const characterDetails = parseCharacterDetails($);
  logInfo("Parsing job info", "lodestone-utils");
  const jobInfo = parseJobInfo($);
  logInfo("Parsing company info", "lodestone-utils");
  const companyInfo = parseCompanyInfo($);
  logInfo("Fetching class/job levels", "lodestone-utils");
  const classJobLevels = await fetchClassJobLevels(id);
  logInfo("Parsing social info", "lodestone-utils");
  const socialInfo = parseSocialInfo($);
  logInfo("Parsing additional info", "lodestone-utils");
  const additionalInfo = parseAdditionalInfo($);

  logInfo("Combining all parsed information", "lodestone-utils");
  return {
    ...basicInfo,
    ...serverInfo,
    ...characterDetails,
    ...jobInfo,
    ...companyInfo,
    classLevels: classJobLevels,
    ...socialInfo,
    ...additionalInfo,
  };
}

function parseBasicInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing character name", "lodestone-utils");
  const name = $(".frame__chara__name").text().trim();
  logInfo(`Character name: ${name}`, "lodestone-utils");

  logInfo("Parsing title", "lodestone-utils");
  const title = $(".frame__chara__title").text().trim() || undefined;
  logInfo(`Title: ${title}`, "lodestone-utils");

  return { name, title };
}

function parseServerInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing server information", "lodestone-utils");
  const server =
    $(".frame__chara__world")
      .text()
      .trim()
      .match(/(?<World>\w*)\s+\[(?<DC>\w*)\]/)?.groups || {};
  logInfo(`Server: ${JSON.stringify(server)}`, "lodestone-utils");

  return { server: `${server.World} [${server.DC}]` };
}

function parseCharacterDetails($: cheerio.CheerioAPI) {
  logInfo("Parsing race, clan, and gender", "lodestone-utils");
  const { race, clan } = parseRaceAndClan($);
  
  // Parse gender - look for gender symbol in the character block
  let gender = "Unknown";
  const characterBlock = $(".character-block__name").first();
  const blockText = characterBlock.text().trim();
  
  // Check for gender symbols
  if (blockText.includes("♀")) {
    gender = "Female";
  } else if (blockText.includes("♂")) {
    gender = "Male";
  } else {
    // Fallback: search the entire page for gender symbol near race/clan text
    const fullText = $("body").text();
    // Look for pattern like "RaceClan / ♀" or "RaceClan / ♂"
    const genderMatch = fullText.match(/[♀♂]/);
    if (genderMatch) {
      gender = genderMatch[0] === "♀" ? "Female" : "Male";
    }
  }
  
  logInfo(
    `Race: ${Race[race]}, Clan: ${Clan[clan]}, Gender: ${gender}`,
    "lodestone-utils",
  );

  logInfo("Parsing nameday", "lodestone-utils");
  const nameday = $(".character-block__birth").text().trim();
  logInfo(`Nameday: ${nameday}`, "lodestone-utils");

  logInfo("Parsing guardian", "lodestone-utils");
  const guardian = $("p.character-block__name:nth-child(4)").text().trim();
  logInfo(`Guardian: ${guardian}`, "lodestone-utils");

  logInfo("Parsing city-state", "lodestone-utils");
  const cityState = $(
    "div.character-block:nth-child(3) > div:nth-child(2) > p:nth-child(2)",
  )
    .text()
    .trim();
  logInfo(`City-state: ${cityState}`, "lodestone-utils");

  return { race, clan, gender, nameday, guardian, cityState };
}

function parseJobInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing job and level information", "lodestone-utils");
  const jobLevelElement = $(".character__class__data p:first-child");
  const level =
    jobLevelElement
      .text()
      .trim()
      .match(/LEVEL (?<Level>\d*)/)?.groups?.Level || "";
  const jobName = jobLevelElement.prev().text().trim();
  const jobIcon = jobLevelElement.prev().find("img").attr("src") || "";
  logInfo(
    `Job: ${jobName}, Level: ${level}, Job Icon: ${jobIcon}`,
    "lodestone-utils",
  );

  const activeClassJob =
    $(".character__class_icon > img:first-child").attr("src") || "";
  const parsedClassJobIcon =
    activeClassJob.split("/").pop()?.split(".")[0] || "";
  logInfo(`Active Class/Job Icon: ${activeClassJob}`, "lodestone-utils");
  logInfo(`Parsed Active Class/Job: ${parsedClassJobIcon}`, "lodestone-utils");

  const jobIconUrl = `https://lds-img.finalfantasyxiv.com/h/K/${parsedClassJobIcon}.png`;
  logInfo(`Job Icon URL: ${jobIconUrl}`, "lodestone-utils");

  const activeJobName = getJobNameFromIcon(activeClassJob);
  logInfo(`Job Name: ${activeJobName}`, "lodestone-utils");

  logInfo("Parsing active class/job level", "lodestone-utils");
  const activeClassJobLevel =
    $(".character__class__data > p:first-child")
      .text()
      .trim()
      .match(/LEVEL (?<Level>\d*)/)?.groups?.Level || "";
  logInfo(`Active Class/Job Level: ${activeClassJobLevel}`, "lodestone-utils");

  return {
    level,
    jobName,
    jobIcon,
    activeClassJob: activeJobName,
    activeClassJobLevel,
    jobIconUrl,
    parsedClassJobIcon,
  };
}

function parseCompanyInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing grand company information", "lodestone-utils");
  const grandCompanyElement = $(
    "div.character-block:nth-child(4) > div:nth-child(2) > p:nth-child(2)",
  );
  const grandCompanyMatch = grandCompanyElement
    .text()
    .trim()
    .match(/(?<Name>\S*) \/ (?<Rank>.*)/);
  const grandCompany = grandCompanyMatch
    ? {
        name: grandCompanyMatch.groups?.Name || "",
        rank: grandCompanyMatch.groups?.Rank || "",
      }
    : undefined;
  logInfo(`Grand Company: ${JSON.stringify(grandCompany)}`, "lodestone-utils");

  logInfo("Parsing free company information", "lodestone-utils");
  const freeCompanyElement = $(
    ".character__freecompany__name > h4:nth-child(2) > a:nth-child(1)",
  );
  const freeCompany = freeCompanyElement.length
    ? {
        name: freeCompanyElement.text().trim(),
        id: freeCompanyElement.attr("href")?.split("/")[3] || "",
      }
    : undefined;
  logInfo(`Free Company: ${JSON.stringify(freeCompany)}`, "lodestone-utils");

  return { grandCompany, freeCompany };
}

async function fetchClassJobLevels(id: string) {
  logInfo("Fetching class/job levels", "lodestone-utils");
  const classJobUrl = `https://na.finalfantasyxiv.com/lodestone/character/${id}/class_job/`;
  logInfo(
    `Fetching class/job info from URL: ${classJobUrl}`,
    "lodestone-utils",
  );
  const classJobResponse = await axios.get(classJobUrl);
  const classJobHtml = classJobResponse.data;
  const $classJob = cheerio.load(classJobHtml);
  const rawClassLevels = await getLodestoneCharacterClassJob(id);

  const classLevels: Partial<
    Record<
      ClassJob,
      ClassJobLevel & { categoryname?: string; jobname?: string }
    >
  > = {};

  try {
    for (const [job, data] of Object.entries(rawClassLevels)) {
      logInfo(`Processing job: ${job}`, "lodestone-utils");
      let levelValue = data.level;
      if (
        levelValue === "Level NaN" ||
        levelValue === "NaN" ||
        Number.isNaN(levelValue)
      ) {
        levelValue = "Class not unlocked";
      }
      classLevels[job as unknown as ClassJob] = {
        level: levelValue,
        experience: data.experience || { currentExp: 0, expToNextLevel: 0 },
        categoryname: data.categoryname,
        jobname: data.jobname,
      };
      logInfo(
        JSON.stringify({
          data: { job, data: classLevels[job as unknown as ClassJob] },
          context: "lodestone-utils",
        }),
        "lodestone-utils",
      );
    }
    logInfo(
      "All class levels processed",
      JSON.stringify({ data: classLevels, context: "lodestone-utils" }),
    );
  } catch (error) {
    logError("Error fetching or processing class/job levels:", error);
    throw error;
  }

  return classLevels;
}

function parseSocialInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing linkshells", "lodestone-utils");
  const linkshells: string[] = [];
  logInfo(`Linkshells: ${linkshells.join(", ")}`, "lodestone-utils");

  logInfo("Parsing cross-world linkshells", "lodestone-utils");
  const crossWorldLinkshells: string[] = [];
  logInfo(
    `Cross-world Linkshells: ${crossWorldLinkshells.join(", ")}`,
    "lodestone-utils",
  );

  logInfo("Parsing bio", "lodestone-utils");
  const bio = $(".character__selfintroduction").text().trim();
  logInfo(`Bio: ${bio}`, "lodestone-utils");

  return { linkshells, crossWorldLinkshells, bio };
}

function parseAdditionalInfo($: cheerio.CheerioAPI) {
  logInfo("Parsing portrait URL", "lodestone-utils");
  const portrait = $(".js__image_popup > img:first-child").attr("src") || "";
  logInfo(`Portrait URL: ${portrait}`, "lodestone-utils");

  logInfo("Parsing avatar URL", "lodestone-utils");
  const avatar = $(".frame__chara__face > img:first-child").attr("src") || "";
  logInfo(`Avatar URL: ${avatar}`, "lodestone-utils");

  logInfo("Parsing guardian deity", "lodestone-utils");
  const guardianDeity = {
    name: $("p.character-block__name:nth-child(4)").text().trim(),
    icon:
      $(
        "#character > div.character__content.selected > div.character__profile.clearfix > div.character__profile__data > div:nth-child(1) > div > div:nth-child(2) > img",
      ).attr("src") || "",
  };
  logInfo(
    `Guardian Deity: ${JSON.stringify(guardianDeity)}`,
    "lodestone-utils",
  );

  logInfo("Parsing PvP team information", "lodestone-utils");
  logInfo("Parsing PvP team information", "lodestone-utils");
  const pvpTeamElement = $(
    ".character__pvpteam__name > h4:nth-child(2) > a:nth-child(1)",
  );
  const pvpTeam = pvpTeamElement.length
    ? {
        name: pvpTeamElement.text().trim(),
        id: pvpTeamElement.attr("href")?.split("/")[3] || "",
      }
    : undefined;
  logInfo(`PvP Team: ${JSON.stringify(pvpTeam)}`, "lodestone-utils");

  logInfo("Parsing Bozja information", "lodestone-utils");
  const bozja = {
    level: $("div.character__job__list:nth-child(7) > div:nth-child(2)")
      .text()
      .trim(),
    mettle:
      $("div.character__job__list:nth-child(7) > div:nth-child(4)")
        .text()
        .trim()
        .match(/(?<Mettle>\S+) \//)?.groups?.Mettle || "",
    name: $("div.character__job__list:nth-child(7) > div:nth-child(3)")
      .text()
      .trim(),
  };
  logInfo(`Bozja: ${JSON.stringify(bozja)}`, "lodestone-utils");

  logInfo("Parsing Eureka information", "lodestone-utils");
  const eureka = {
    level: $("div.character__job__list:nth-child(9) > div:nth-child(2)")
      .text()
      .trim(),
    exp: $("div.character__job__list:nth-child(9) > div:nth-child(4)")
      .text()
      .trim(),
    name: $("div.character__job__list:nth-child(9) > div:nth-child(3)")
      .text()
      .trim(),
  };
  logInfo(`Eureka: ${JSON.stringify(eureka)}`, "lodestone-utils");

  return { portrait, avatar, guardianDeity, pvpTeam, bozja, eureka };
}
async function searchCharacter(
  server: string,
  name: string,
): Promise<string | null> {
  const url = `https://na.finalfantasyxiv.com/lodestone/character/?q=${encodeURIComponent(name)}&worldname=${encodeURIComponent(server)}`;
  centralLogger({
    level: LogLevel.INFO,
    message: `Searching character with URL: ${url}`,
    context: "lodestone-utils",
  });
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  const characterLink = $(".entry__link").first().attr("href");
  if (characterLink) {
    const idMatch = characterLink.match(/(\d+)/);
    const characterId = idMatch ? idMatch[1] : null;
    centralLogger({
      level: LogLevel.INFO,
      message: `Found character ID: ${characterId}`,
      context: "lodestone-utils",
    });
    return characterId;
  }
  centralLogger({
    level: LogLevel.INFO,
    message: "Character not found",
    context: "lodestone-utils",
  });
  return null;
}

function convertRace(raceEnum: number): string {
  // Order must match the Race enum: Hyur, Elezen, Lalafell, Miqote, Roegadyn, AuRa, Viera, Hrothgar
  const races = [
    "Hyur",
    "Elezen",
    "Lalafell",
    "Miqo'te",
    "Roegadyn",
    "Au Ra",
    "Viera",
    "Hrothgar",
  ];
  return races[raceEnum] || "Unknown";
}

function convertClan(clanEnum: number): string {
  // Order must match the Clan enum:
  // Hyur: Midlander, Highlander
  // Elezen: Wildwood, Duskwight
  // Lalafell: Plainsfolk, Dunesfolk
  // Miqo'te: SeekerOfTheSun, KeeperOfTheMoon
  // Roegadyn: SeaWolf, Hellsguard
  // Au Ra: Raen, Xaela
  // Viera: Rava, Veena
  // Hrothgar: Helion, Lost
  const clans = [
    "Midlander",
    "Highlander",
    "Wildwood",
    "Duskwight",
    "Plainsfolk",
    "Dunesfolk",
    "Seeker of the Sun",
    "Keeper of the Moon",
    "Sea Wolf",
    "Hellsguard",
    "Raen",
    "Xaela",
    "Rava",
    "Veena",
    "Helion",
    "Lost",
  ];
  return clans[clanEnum] || "Unknown";
}

export {
  getJobNameFromIcon,
  parseRaceAndClan,
  scrapeCharacterClassJob,
  getLodestoneCharacterClassJob,
  fetchCharacterInfo,
  searchCharacter,
  convertRace,
  convertClan,
};
