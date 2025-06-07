import { DependencyContainer } from "tsyringe";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ImageRouter } from "@spt/routers/ImageRouter";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import baseJson from "../db/base.json";
import * as fs from "fs";
import * as path from "path";
import { Traders } from "@spt/models/enums/Traders";

class GunsmithMod implements IPreSptLoadMod, IPostDBLoadMod {
  private mod: string;
  private logger: ILogger;

  constructor() {
    this.modRoot = path.join(__dirname, "../");
    this.mod = "yurikus.gunsmith";
  }

  public preSptLoad(container: DependencyContainer): void {
    this.logger = container.resolve<ILogger>("WinstonLogger");

    this.logger.debug(`[${this.mod}] PreSpt Loading...`);

    const preSptModLoader: PreSptModLoader =
      container.resolve<PreSptModLoader>("PreSptModLoader");
    const imageRouter: ImageRouter =
      container.resolve<ImageRouter>("ImageRouter");
    const configServer: ConfigServer =
      container.resolve<ConfigServer>("ConfigServer");
    const traderConfig = configServer.getConfig(ConfigTypes.TRADER);
    const ragfairConfig = configServer.getConfig(ConfigTypes.RAGFAIR);

    // Register profile image
    this.registerProfileImage(preSptModLoader, imageRouter);

    // Set trader update time
    this.setupTraderUpdateTime(traderConfig);

    // Add trader to enums and ragfair
    Traders[baseJson._id] = baseJson._id;
    ragfairConfig.traders[baseJson._id] = true;

    this.logger.debug(`[${this.mod}] PreSpt Loaded`);
  }

  public postDBLoad(container: DependencyContainer): void {
    this.logger.debug(`[${this.mod}] PostDb Loading...`);

    const databaseServer: DatabaseServer =
      container.resolve<DatabaseServer>("DatabaseServer");
    const jsonUtil: JsonUtil = container.resolve<JsonUtil>("JsonUtil");
    const tables = databaseServer.getTables();

    const assortPath = path.join(this.modRoot, "/db/assort.json");

    let assortData;

    // Check if assort file exists
    if (fs.existsSync(assortPath)) {
      this.logger.debug(`[${this.mod}] Loading existing assort file.`);
      assortData = JSON.parse(fs.readFileSync(assortPath, "utf-8"));
    } else {
      this.logger.debug(
        `[${this.mod}] Generating new assort file from presets.`
      );
      assortData = this.generateAssort();
      fs.writeFileSync(
        assortPath,
        JSON.stringify(assortData, null, 4),
        "utf-8"
      );
      this.logger.debug(`[${this.mod}] Assort file saved to ${assortPath}`);
    }

    // Add trader to the database
    this.addTraderToDb(baseJson, tables, jsonUtil, assortData);

    // Add trader to locales
    this.addTraderToLocales(
      tables,
      baseJson.name,
      "Gunsmith",
      baseJson.nickname,
      baseJson.location,
      "A distinguished gunsmith who smuggles some of the best weapons and equipment into Tarkov. Also he is excellent in repairing weapons and armor."
    );

    this.logger.debug(`[${this.mod}] PostDb Loaded`);
  }

  private registerProfileImage(
    preSptModLoader: PreSptModLoader,
    imageRouter: ImageRouter
  ): void {
    imageRouter.addRoute(
      baseJson.avatar.replace(".jpg", ""),
      `${this.modRoot}/res/gunsmith.jpg`
    );
  }

  private setupTraderUpdateTime(traderConfig): void {
    const traderRefreshRecord = {
      traderId: baseJson._id,
      seconds: { min: 1000, max: 6000 },
    };
    traderConfig.updateTime.push(traderRefreshRecord);
  }

  private addTraderToDb(
    traderDetailsToAdd: any,
    tables: IDatabaseTables,
    jsonUtil: JsonUtil,
    assortData
  ): void {
    tables.traders[traderDetailsToAdd._id] = {
      assort: assortData,
      base: jsonUtil.deserialize(jsonUtil.serialize(traderDetailsToAdd)),
      questassort: {
        started: {},
        success: {},
        fail: {},
      },
    };
  }

  private generateAssort(): any {
    const presetsPath = path.join(this.modRoot, "/db/presets.json");
    if (!fs.existsSync(presetsPath)) {
      this.logger.error(`[${this.mod}] Presets file not found.`);
      return {
        nextResupply: 600,
        items: [],
        barter_scheme: {},
        loyal_level_items: {},
      };
    }

    const presets = JSON.parse(fs.readFileSync(presetsPath, "utf-8"));
    const assort = {
      nextResupply: 600,
      items: [],
      barter_scheme: {},
      loyal_level_items: {},
    };

    Object.values(presets).forEach((preset: any) => {
      if (!preset.items) {
        this.logger.error(
          `[${this.mod}] Preset items are not defined for preset: ${preset}`
        );
        return;
      }

      preset.items.forEach((item: any) => {
        assort.items.push({
          _id: item._id,
          _tpl: item._tpl,
          parentId: item.parentId || "hideout",
          slotId: item.slotId || "hideout",
          upd:
            item._id === preset.root
              ? { UnlimitedCount: false, StackObjectsCount: 1 }
              : { StackObjectsCount: 1 },
        });
      });

      assort.barter_scheme[preset.root] = [
        [
          {
            count: preset.price,
            _tpl: "5449016a4bdc2d6f028b456f", // Rubles template ID
          },
        ],
      ];
      assort.loyal_level_items[preset.root] = 1;
    });

    return assort;
  }

  private addTraderToLocales(
    tables: IDatabaseTables,
    fullName: string,
    firstName: string,
    nickName: string,
    location: string,
    description: string
  ): void {
    const locales = Object.values(tables.locales.global) as Record<
      string,
      string
    >[];
    for (const locale of locales) {
      locale[`${baseJson._id} FullName`] = fullName;
      locale[`${baseJson._id} FirstName`] = firstName;
      locale[`${baseJson._id} Nickname`] = nickName;
      locale[`${baseJson._id} Location`] = location;
      locale[`${baseJson._id} Description`] = description;
    }
  }

  private generateHexID(): string {
    return "xxxxxxxxxxxxxxxxxxxxxxxx".replace(/[x]/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }
}

export const mod = new GunsmithMod();
