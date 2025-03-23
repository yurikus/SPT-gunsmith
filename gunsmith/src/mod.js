"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mod = void 0;
const ConfigTypes_1 = require("C:/snapshot/project/obj/models/enums/ConfigTypes");
const base_json_1 = __importDefault(require("../db/base.json"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Traders_1 = require("C:/snapshot/project/obj/models/enums/Traders");
class GunsmithMod {
    mod;
    logger;
    constructor() {
        this.mod = "gunsmith";
    }
    preSptLoad(container) {
        this.logger = container.resolve("WinstonLogger");
        this.logger.debug(`[${this.mod}] PreSpt Loading...`);
        const preSptModLoader = container.resolve("PreSptModLoader");
        const imageRouter = container.resolve("ImageRouter");
        const configServer = container.resolve("ConfigServer");
        const traderConfig = configServer.getConfig(ConfigTypes_1.ConfigTypes.TRADER);
        const ragfairConfig = configServer.getConfig(ConfigTypes_1.ConfigTypes.RAGFAIR);
        // Register profile image
        this.registerProfileImage(preSptModLoader, imageRouter);
        // Set trader update time
        this.setupTraderUpdateTime(traderConfig);
        // Add trader to enums and ragfair
        Traders_1.Traders[base_json_1.default._id] = base_json_1.default._id;
        ragfairConfig.traders[base_json_1.default._id] = true;
        this.logger.debug(`[${this.mod}] PreSpt Loaded`);
    }
    postDBLoad(container) {
        this.logger.debug(`[${this.mod}] PostDb Loading...`);
        const databaseServer = container.resolve("DatabaseServer");
        const jsonUtil = container.resolve("JsonUtil");
        const tables = databaseServer.getTables();
        const assortPath = path.join(__dirname, "../db/assort.json");
        let assortData;
        // Check if assort file exists
        if (fs.existsSync(assortPath)) {
            this.logger.debug(`[${this.mod}] Loading existing assort file.`);
            assortData = JSON.parse(fs.readFileSync(assortPath, "utf-8"));
        }
        else {
            this.logger.debug(`[${this.mod}] Generating new assort file from presets.`);
            assortData = this.generateAssort();
            fs.writeFileSync(assortPath, JSON.stringify(assortData, null, 4), "utf-8");
            this.logger.debug(`[${this.mod}] Assort file saved to ${assortPath}`);
        }
        // Add trader to the database
        this.addTraderToDb(base_json_1.default, tables, jsonUtil, assortData);
        // Add trader to locales
        this.addTraderToLocales(tables, base_json_1.default.name, "Gunsmith", base_json_1.default.nickname, base_json_1.default.location, "A distinguished gunsmith who smuggles some of the best weapons and equipment into Tarkov. Also he is excellent in repairing weapons and armor.");
        this.logger.debug(`[${this.mod}] PostDb Loaded`);
    }
    registerProfileImage(preSptModLoader, imageRouter) {
        const imageFilepath = `./${preSptModLoader.getModPath(this.mod)}res`;
        imageRouter.addRoute(base_json_1.default.avatar.replace(".jpg", ""), `${imageFilepath}/gunsmith.jpg`);
    }
    setupTraderUpdateTime(traderConfig) {
        const traderRefreshRecord = {
            traderId: base_json_1.default._id,
            seconds: { min: 1000, max: 6000 },
        };
        traderConfig.updateTime.push(traderRefreshRecord);
    }
    addTraderToDb(traderDetailsToAdd, tables, jsonUtil, assortData) {
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
    generateAssort() {
        const presetsPath = path.join(__dirname, "../db/presets.json");
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
        Object.values(presets).forEach((preset) => {
            if (!preset.items) {
                this.logger.error(`[${this.mod}] Preset items are not defined for preset: ${preset}`);
                return;
            }
            preset.items.forEach((item) => {
                assort.items.push({
                    _id: item._id,
                    _tpl: item._tpl,
                    parentId: item.parentId || "hideout",
                    slotId: item.slotId || "hideout",
                    upd: item._id === preset.root
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
    addTraderToLocales(tables, fullName, firstName, nickName, location, description) {
        const locales = Object.values(tables.locales.global);
        for (const locale of locales) {
            locale[`${base_json_1.default._id} FullName`] = fullName;
            locale[`${base_json_1.default._id} FirstName`] = firstName;
            locale[`${base_json_1.default._id} Nickname`] = nickName;
            locale[`${base_json_1.default._id} Location`] = location;
            locale[`${base_json_1.default._id} Description`] = description;
        }
    }
    generateHexID() {
        return "xxxxxxxxxxxxxxxxxxxxxxxx".replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
    }
}
exports.mod = new GunsmithMod();
//# sourceMappingURL=mod.js.map