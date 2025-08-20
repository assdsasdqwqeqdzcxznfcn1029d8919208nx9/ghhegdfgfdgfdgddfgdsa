(() => {
  "use strict";

  const STARBLAST_URL = "https://starblast.io";
  const CACHE_KEY = "tetra_src";
  const HASH_KEY = "tetra_hash";

  const Tetra = {
    plugins: [],
    commands: {},
    injectors: [],
    runners: [],

    log: (...args) => console.log("%c[yaraksı clientsi]", "color: violet;", ...args),

    register(plugin) {
      if (typeof plugin.init === "function") {
        this.plugins.push(plugin);
        plugin.init();
        this.log(`Plugin "${plugin.name}" registered and initialized`);
      }
    },

    command(name, handler) {
      this.commands[name] = handler;
      this.log(`Command "${name}" registered`);
    },

    exec(cmd, ...args) {
      if (this.commands[cmd]) return this.commands[cmd](...args);
      else console.warn(`[Tetra] Unknown command: ${cmd}`);
    },

    onInject(fn) {
      if (typeof fn === "function") this.injectors.push(fn);
    },

    onRun(fn) {
      if (typeof fn === "function") this.runners.push(fn);
    },
  };

  window.Tetra = Tetra;
  window.tetra = Tetra.exec.bind(Tetra);
    //crystal
    // === PLUGIN: Crystal Color Toggle (Mesh + HUD + Ship Tag + Pickup text) ===
// === PLUGIN: Crystal Color Toggle (Mesh + HUD + Ship Tag + Pickup text) ===
Tetra.register({
  name: "CrystalColorToggle",
  init() {
    // --- Configuration Keys ---
    const MESH_KEY = "crystalColorEnabled";
    const HUD_KEY = "crystalHudEnabled";
    const TAG_KEY = "crystalTagEnabled";
    const PICKUP_KEY = "crystalPickupEnabled";
    const COLOR_KEY = "crystal-color";

    // --- Logger ---
    const log = (msg, err = false) =>
      console[err ? "error" : "log"](`%c[CrystalColor] ${msg}`, `color:${err ? "red" : "#AA00FF"}`);

    // --- Set Default Values in localStorage ---
    if (localStorage.getItem(MESH_KEY) == null) localStorage.setItem(MESH_KEY, "false");
    if (localStorage.getItem(HUD_KEY) == null) localStorage.setItem(HUD_KEY, "false");
    if (localStorage.getItem(TAG_KEY) == null) localStorage.setItem(TAG_KEY, "false");
    if (localStorage.getItem(PICKUP_KEY) == null) localStorage.setItem(PICKUP_KEY, "false");
    if (localStorage.getItem(COLOR_KEY) == null) localStorage.setItem(COLOR_KEY, "hsla(141,100%,50%,0.75)");

    // --- MASTER SWITCH ---
    if (localStorage.getItem(MESH_KEY) !== "true") {
      log("Master switch is disabled. CrystalColorToggle will not run.");
      return;
    }

    // --- Main patching logic, to be called after THREE.js is found ---
    const applyPatches = (THREE) => {
      log("Master switch is enabled. Applying active patches...");
      const COLOR = localStorage.getItem(COLOR_KEY);

      // Patch 1: Crystal Mesh Color (Always runs if master switch is on)
      let CrystalObject;
      for (let i in window) {
        try {
          const val = window[i];
          if (typeof val === "function" && typeof val.prototype.createModel === "function" &&
            val.prototype.createModel.toString().includes("Crystal")) {
            CrystalObject = val;
            break;
          }
        } catch (e) {}
      }
      if (CrystalObject) {
        const oldModel = CrystalObject.prototype.getModelInstance;
        CrystalObject.prototype.getModelInstance = function() {
          const res = oldModel.apply(this, arguments);
          if (COLOR && res?.material?.color?.set) {
            try {
              res.material.color.set(COLOR);
            } catch (e) {
              log("Invalid crystal color for 3D object. Check your color string.", true);
            }
          }
          return res;
        };
        log("Patched CrystalObject for mesh color.");
      }

      // Patch 2: HUD Bar Color
      if (localStorage.getItem(HUD_KEY) === "true") {
        let HUDClass;
        for (let k in window) {
          try {
            const val = window[k];
            if (typeof val === "function" && val.toString().includes("this.crystal_index") &&
              val.toString().includes("this.initBar") && val.prototype?.setBarColor) {
              HUDClass = val;
              break;
            }
          } catch (e) {}
        }
        if (HUDClass) {
          const oldUpdateLevel = HUDClass.prototype.updateLevel;
          HUDClass.prototype.updateLevel = function() {
            const result = oldUpdateLevel.apply(this, arguments);
            try {
              if (COLOR && typeof this.setBarColor === "function") {
                const c = new THREE.Color(COLOR);
                this.setBarColor(this.crystal_index, c.r, c.g, c.b);
              }
            } catch (e) {
              log("Failed to set HUD bar color.", true);
            }
            return result;
          };
          log("Patched HUD for bar color.");
        }
      } else {
        log("HUD patch is disabled via localStorage.");
      }

      // Patch 3: Ship Tag Bar Color
      if (localStorage.getItem(TAG_KEY) === "true") {
        try {
          let patched = false;
          let cargoPattern = /([^,]+)("hsla\(0,100%,75%,\.75\)")/;
          for (let i in window) {
            try {
              let proto = window[i]?.prototype;
              if (!proto) continue;
              for (let j in proto) {
                let func = proto[j];
                if (typeof func === "function" && func.toString().match(cargoPattern)) {
                  proto[j] = Function("return " + func.toString().replace(
                    cargoPattern,
                    "$1" + JSON.stringify(COLOR)
                  ))();
                  patched = true;
                  log("Patched Ship Tag for bar color.");
                  break;
                }
              }
            } catch (e) {}
            if (patched) break;
          }
        } catch (e) {
          log("Ship tag bar patch failed: " + e.message, true);
        }
      } else {
        log("Ship Tag patch is disabled via localStorage.");
      }

      // Patch 4: Floating Pickup Text Color
      if (localStorage.getItem(PICKUP_KEY) === "true") {
        let FiguresClass;
        for (let k in window) {
          try {
            const val = window[k];
            if (typeof val === "function" && val.prototype?.bonus &&
              val.prototype.bonus.toString().includes("this.vertices")) {
              FiguresClass = val;
              break;
            }
          } catch (e) {}
        }
        if (FiguresClass) {
          const oldBonus = FiguresClass.prototype.bonus;
          FiguresClass.prototype.bonus = function(amount, x, y, color, icon, ...rest) {
            try {
              if (icon === 11 && COLOR) { // icon 11 is the crystal pickup icon
                let c = COLOR;
                if (c.startsWith("#")) {
                  c = parseInt(c.slice(1), 16);
                } else if (c.startsWith("rgb") || c.startsWith("hsl")) {
                  const ctx = document.createElement("canvas").getContext("2d");
                  ctx.fillStyle = c;
                  c = parseInt(ctx.fillStyle.slice(1), 16);
                }
                color = c;
              }
            } catch (e) {
              log("Failed to parse color for pickup text.", true);
            }
            return oldBonus.call(this, amount, x, y, color, icon, ...rest);
          };
          log("Patched Figures for pickup text color.");
        }
      } else {
        log("Pickup Text patch is disabled via localStorage.");
      }

      log("CrystalColorToggle initialized successfully.");
    };

    // --- Wait for THREE.js to load, then apply patches ---
    let attempts = 0;
    const maxAttempts = 20; // Try for 10 seconds (20 * 500ms)
    const interval = setInterval(() => {
      let THREE;
      for (let k in window) {
        try {
          if (typeof window[k]?.Color === "function" && typeof window[k]?.Vector3 === "function") {
            THREE = window[k];
            break;
          }
        } catch (e) {}
      }

      if (THREE) {
        clearInterval(interval);
        log("THREE.js found.");
        applyPatches(THREE);
      } else {
        attempts++;
        if (attempts === 1) {
            log("THREE.js not found yet, waiting...");
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          log("THREE.js could not be found. Aborting.", true);
        }
      }
    }, 500);
  }
});

    // === PLUGIN: Chat Emotes Capacity ===
Tetra.register({
  name: "ChatEmotesCapacity",
  init() {
    const STORAGE_KEY = "chat_emotes_capacity";
    const DEFAULT_CAPACITY = 4;
    const MAX_CAPACITY = 5;

    const log = (msg, err = false) =>
      console[err ? "error" : "log"](`%c[ChatEmotes] ${msg}`, `color: ${err ? "red" : "#FFD700"}`);

    // Check if ChatPanel is available
    const tryPatch = () => {
      if (typeof window.ChatPanel === "undefined") {
        log("ChatPanel not found! Retrying in 1 second...", true);
        setTimeout(tryPatch, 1000);
        return;
      }

      try {
        // Extract global variable pattern like original mod
        let globalVal = ChatPanel.toString().match(/[0OlI1]{5}/)?.[0];
        if (!globalVal) {
          log("Could not find global variable pattern!", true);
          return;
        }
        log(`Found global variable: ${globalVal}`);

        // Add capacity getter
        ChatPanel.prototype.getEmotesCapacity = function () {
          let num = parseInt(localStorage.getItem(STORAGE_KEY));
          try {
            return (num == null || isNaN(num))
              ? DEFAULT_CAPACITY
              : (Math.trunc(Math.min(Math.max(1, num), MAX_CAPACITY)) || DEFAULT_CAPACITY);
          } catch {
            return DEFAULT_CAPACITY;
          }
        };

        // Patch typed() method
        ChatPanel.prototype.typed = Function("return " +
          ChatPanel.prototype.typed.toString().replace(/>=\s*4/, ">= this.getEmotesCapacity()")
        )();

        log("Successfully patched ChatPanel.typed method");


        // Initialize default value if unset
        if (localStorage.getItem(STORAGE_KEY) === null) {
          localStorage.setItem(STORAGE_KEY, "4");
        }

        const currentCapacity = parseInt(localStorage.getItem(STORAGE_KEY)) || DEFAULT_CAPACITY;
        log(`Plugin initialized successfully. Current capacity: ${currentCapacity}`);

      } catch (e) {
        log("Failed to patch ChatPanel: " + e.message, true);
        console.error(e);
      }
    };

    // Kick off patch attempts
    tryPatch();
  }
});


    // === PLUGIN: Custom Emotes (Survival Only) ===
Tetra.register({
  name: "CustomEmotesSurvival",
  init() {
    const STORAGE_KEY = "customEmotesEnabled";
    if (localStorage.getItem(STORAGE_KEY) == null) {
      localStorage.setItem(STORAGE_KEY, "false");
    }

    const enabled = localStorage.getItem(STORAGE_KEY) === "true";
    const emoteModName = "Custom Emote (Survival)";
    const log = (msg, err = false) =>
      console[err ? "error" : "log"](
        `%c[${emoteModName}] ${msg}`,
        `color:${err ? "red" : "#FFA500"}`
      );

    if (!enabled) {
      log("Disabled via localStorage");
      return;
    }

    Tetra.onInject((src) => {
      log("onInject called. Patching SurvivalMode vocabulary…");

      let prev = src;

      // Narrow down only inside SurvivalMode function
      const survivalBlock = /(this\.SurvivalMode\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?this\.vocabulary\s*=\s*\[[\s\S]*?\}\s*\])/;

      if (!survivalBlock.test(src)) {
        log("Could not locate SurvivalMode vocabulary.", true);
        return src;
      }

      // Now specifically patch after the "Hmm" entry
      const hmmPattern = /(\{[^}]*text:\s*"Hmm"[^}]*\})/;

      const emotes = `,{
        text: "dc bak",
        icon: "💬",
        key: "D"
      },{
        text: "Orosbu Evladı",
        icon: "🤡",
        key: "J"
      },{
        text: "Anime Kızı",
        icon: "🥰",
        key: "I"
      },{
        text: "ZenciGOT",
        icon: "😱",
        key: "V"
      }`;

      src = src.replace(hmmPattern, `$1${emotes}`);

      if (src === prev) {
        log("Patch failed: Hmm emote not found inside SurvivalMode!", true);
      } else {
        log("Custom emotes appended under Hmm (Survival only).");
      }

      return src;
    });
  },
});


    // === PLUGIN: Hue Material Adjust ===
Tetra.register({
  name: "HueMaterialAdjust",
  init() {
    const STORAGE_KEY = "hueMaterialEnabled";
    if (localStorage.getItem(STORAGE_KEY) == null) {
      localStorage.setItem(STORAGE_KEY, "false");
    }

    const enabled = localStorage.getItem(STORAGE_KEY) === "true";
    const modName = "HueMaterialAdjust";
    const log = (msg, err = false) =>
      console[err ? "error" : "log"](
        `%c[${modName}] ${msg}`,
        `color:${err ? "red" : "#39c5bb"}`
      );

    if (!enabled) {
      log("Disabled via localStorage");
      return;
    }

    Tetra.onInject((src) => {
      log("onInject called. Patching hue values…");

      let prev = src;
      src = src.replace(/this\.hue,\.5,1/g, "this.hue,1,1");

      if (src === prev) {
        log("No replacements made (pattern not found).", true);
      } else {
        log("Patched hue .5 → 1 successfully.");
      }

      return src;
    });
  },
});

// === PLUGIN: Self Ship Tag (New Version) ===
Tetra.register({
    name: "SelfShipTag",
    init() {
        if (localStorage.getItem("selftag") == null) {
            localStorage.setItem("selftag", "true");
        }

        const log = (msg, err = false) => console[err ? "error" : "log"](`%c[SelfShipTag] ${msg}`, `color:${err ? "red" : "#00ff00"}`);

        const applyPatch = () => {
            try {
                // --- 1. Find the Ship Tag Class and its methods by searching for unique code patterns ---
                let ShipTagClass, shipTagClassName, updateMethodName, colorMethodName, playerDataVar;
                for (let name in window) {
                    try {
                        let proto = window[name]?.prototype;
                        if (!proto) continue;

                        let currentUpdateMethod, currentPlayerDataVar;
                        for (let key in proto) {
                            let func = proto[key];
                            if (typeof func !== "function") continue;
                            let str = func.toString();

                            if (str.includes('hsla(180,100%,75%,.75)')) colorMethodName = key;
                            let match = str.match(/===(\w+\.[^,]+)\.hue/);
                            if (match) {
                                currentUpdateMethod = key;
                                currentPlayerDataVar = match[1];
                            }
                        }

                        if (colorMethodName && currentUpdateMethod && currentPlayerDataVar) {
                            ShipTagClass = window[name];
                            shipTagClassName = name;
                            updateMethodName = currentUpdateMethod;
                            playerDataVar = currentPlayerDataVar;
                            break;
                        }
                    } catch {}
                }

                if (!ShipTagClass) return log("Could not find ShipTag class. Aborting.", true);
                log(`Found ShipTag class: ${shipTagClassName}`);

                // --- 2. Patch the found methods ---
                let tagProto = ShipTagClass.prototype;
                tagProto[updateMethodName] = Function('return ' + tagProto[updateMethodName].toString().replace(/(\.id)/, `$1, this.selfShip = this.shipid == ${playerDataVar}.id`))();
                tagProto[colorMethodName] = Function('return ' + tagProto[colorMethodName].toString().replace(/([^,]+)("hsla\(180,100%,75%,\.75\)")/, "$1 this.selfShip ? 'hsla(341, 100%, 85%, 1)' : $2"))();
                log("Patched ShipTag update and color methods.");

                // --- 3. Find the main Scene class ---
                let sceneProto = Object.getPrototypeOf(Object.values(Object.values(window.module.exports.settings).find(v => v && v.mode)).find(v => v && v.background));
                let Scene = sceneProto.constructor;
                let sceneProtoRef = Scene.prototype;
                let sceneString = Scene.toString();

                if (!Scene) return log("Could not find Scene class. Aborting.", true);
                log(`Found Scene class`);

                // --- 4. Extract key variable names from the Scene's code ---
                let playerVar = sceneString.match(/(\w+)\.hue/)[1];
                let addVar = sceneString.match(/(\w+)\.add\(/)[1];
                let bubbleVar = sceneString.match(/chat_bubble\.(\w+)/)[1];

                // --- 5. Patch the Scene constructor to add our own ship tag ---
                let PatchedScene = Function('return ' + sceneString.replace(/}$/, `, this.welcome || (this.ship_tag = new ${shipTagClassName}(Math.floor(360 * 0)), this.${addVar}.add(this.ship_tag.${bubbleVar}))}`))();
                PatchedScene.prototype = sceneProtoRef;
                PatchedScene.prototype.constructor = PatchedScene;
                sceneProto.constructor = PatchedScene;
                log("Patched Scene constructor.");

                // --- 6. Add the updater method to the Scene prototype ---
                PatchedScene.prototype.updateShipTag = function() {
                    if (this.ship_tag == null) return;
                    if (!this.shipKey) {
                        this.shipKey = Object.keys(this).find(k => this[k] && this[k].ships);
                        let shipVal = this[this.shipKey];
                        this.statusKey = Object.keys(shipVal).find(k => shipVal[k] && shipVal[k].status);
                    }
                    let playerData = this[playerVar];
                    let shipInstance = this[this.shipKey][this.statusKey];
                    this.ship_tag[updateMethodName](playerData, playerData.names.get(shipInstance.status.id), shipInstance.status, shipInstance.instance);
                    let pos = this.ship_tag[bubbleVar].position;
                    pos.x = shipInstance.status.x;
                    pos.y = shipInstance.status.y - 2 - shipInstance.type.radius;
                    pos.z = 1;
                    this.ship_tag[bubbleVar].visible = localStorage.getItem('selftag') === 'true' && shipInstance.status.alive && !shipInstance.status.guided;
                };

                // --- 7. Hook into the render loop ---
                let renderMethodName = Object.keys(sceneProtoRef).find(k => typeof sceneProtoRef[k] === 'function' && sceneProtoRef[k].toString().includes('render'));
                PatchedScene.prototype[renderMethodName] = Function('return ' + PatchedScene.prototype[renderMethodName].toString().replace(/(\w+\.render)/, 'this.updateShipTag(), $1'))();
                log("Hooked into render loop.");

                // --- 8. Find all classes that create a 'new Scene' and replace it with our patched version ---
                let translateFunc = (...args) => window.module.exports.translate(...args);
                for (let key in window) {
                    try {
                        let obj = window[key];
                        if (typeof obj.prototype.refused === 'function') {
                            for (let method in obj.prototype) {
                                let func = obj.prototype[method];
                                if (typeof func === 'function' && func.toString().includes('new Scene')) {
                                    obj.prototype[method] = Function('Scene', 't', 'return ' + func.toString())(PatchedScene, translateFunc);
                                }
                            }
                        }
                    } catch (_) {}
                }
                log("Updated all Scene references.");

            } catch (e) {
                log("An error occurred during patching: " + e.message, true);
                console.error(e);
            }
        };

        // Delay execution until the game has had time to initialize
        setTimeout(applyPatch, 1500);
    }
});



// === PLUGIN: AccurateNameDisplay (Lowercase Support) ===
Tetra.register({
  name: "Lowercase Names",
  init() {
    const STORAGE_KEY = "accurateNameDisplayEnabled";

    // Default to enabled if not set
    if (localStorage.getItem(STORAGE_KEY) == null) {
      localStorage.setItem(STORAGE_KEY, "false");
    }

    const enabled = localStorage.getItem(STORAGE_KEY) === "true";

const log = (msg, err = false) =>
  console[err ? "error" : "log"](
    `%c[LowrcaseNames] ${msg}`,
    `color:${err ? "red" : "#ab051b"}`
  );


    const applyNameFixes = () => {
      try {
        // Patch Names.prototype.set
        const original = Names.prototype.set.toString();
        const customMatch = original.match(/=\s*(\w+)\.custom/);
        const globalMatch = original.match(/\w+\s*={2,3}\s*this\.(.+?)\.[^&]+/);

        if (!customMatch || !globalMatch)
          throw new Error("Unable to locate internal identifiers.");

        const customVar = customMatch[1];
        const globalObj = globalMatch[1];
        const condition = globalMatch[0];

        Names.prototype.set = Function(
          "return " +
            original.replace(
              /return\s+[^]+?\)/,
              `return ${condition} ? (
                this.${globalObj}.player_name = ${customVar}.player_name,
                Object.values(this.${globalObj}).find(a => a?.additional_badges).custom = ${customVar}.custom || {}
              )`
            )
        )();

        log("Patched Names.prototype.set");
      } catch (e) {
        log("Failed Names patch: " + e.message, true);
      }

      try {
        // Disable text-transform on player name input
        const interval = setInterval(() => {
          try {
            const input = document.querySelector(".player-app input, #player input");
            if (input) {
              input.style.textTransform = "none";
              clearInterval(interval);
              log("Disabled textTransform on input");
            }
          } catch {}
        }, 50);
      } catch (e) {
        log("Failed input style patch: " + e.message, true);
      }

      try {
        // Patch startGame() to allow lowercase names
        for (let key in window) {
          const obj = window[key];
          if (obj?.prototype?.startModdingMode && obj.prototype?.startGame) {
            const startGameCode = obj.prototype.startGame.toString();
            if (startGameCode.includes(".toUpperCase()")) {
              obj.prototype.startGame = Function(
                "return " + startGameCode.replace(/\.toUpperCase\(\)/g, "")
              )();
              log("Patched startGame to allow lowercase names");
              break;
            }
          }
        }
      } catch (e) {
        log("Failed startGame patch: " + e.message, true);
      }
    };

    // Wait for Names to be available
    if (enabled) {
      let attempts = 0;
      const maxAttempts = 20; // ~10s
      const interval = setInterval(() => {
        if (typeof window.Names !== "undefined") {
          clearInterval(interval);
          log("Names found. Applying fixes...");
          applyNameFixes();
        } else {
          attempts++;
          if (attempts === 1) log("Waiting for Names...");
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            log("Names could not be found. Aborting.", true);
          }
        }
      }, 500);
    } else {
      log("Disabled — set localStorage.accurateNameDisplayEnabled = 'true' to enable.");
    }
  }
});


  // --- PLUGINS REGISTER HERE (BEFORE INJECTION STARTS) ---
  Tetra.register({
    name: "BlankBadgeDisplay",
    init() {
      const STORAGE_KEY = "showBlankBadge";
      const enabled = localStorage.getItem(STORAGE_KEY) === "true";
      if (!enabled) {
        console.log("[BlankBadgeDisplay] Disabled via localStorage");
        return;
      }

      Tetra.onInject((src) => {
        console.log("[BlankBadgeDisplay] onInject called. Source length:", src.length);
        let changes = 0;

        if (/"blank"!==\w+\.custom\.badge/.test(src)) {
          src = src.replace(/"blank"!==\w+\.custom\.badge/, '""!==$&'.replace('"blank"', ''));
          console.log("[BlankBadgeDisplay] Patch1 applied.");
          changes++;
        }
        if (/case"star":[^}]*?break;/.test(src)) {
          src = src.replace(
            /case"star":[^}]*?break;/,
            '$&case"blank":t.fillStyle="hsla(200,0%,0%,0)";break;'
          );
          console.log("[BlankBadgeDisplay] Patch2 applied.");
          changes++;
        }
        if (/default:t\.fillStyle="hsl\(50,100%,70%\)".*?fillText\("S".*?\)/.test(src)) {
          src = src.replace(
            /default:t\.fillStyle="hsl\(50,100%,70%\)".*?fillText\("S".*?\)/,
            'case"blank":t.fillStyle="hsla(200,0%,0%,1)";break;default:t.fillStyle="hsl(50,100%,70%)",t.fillText("S",e/2,i/2)'
          );
          console.log("[BlankBadgeDisplay] Patch3 applied.");
          changes++;
        }
        console.log(`[BlankBadgeDisplay] Patches applied: ${changes}`);
        return src;
      });
    }
  });




  // === INJECTION CORE (runs AFTER plugins are ready) ===
  let src = localStorage.getItem(CACHE_KEY);
  if (src) {
    inject(src);
    refreshCache();
  } else {
    fetchFresh().then(inject).catch((e) => console.error("Tetra fatal error", e));
  }

  function inject(code) {
    Tetra.log("Starting injection...");
    try {
      for (const fn of Tetra.injectors) {
        try { code = fn(code) ?? code; }
        catch (e) { console.error("Injector error", e); }
      }
      document.open();
      document.write(code);
      document.close();

      for (const fn of Tetra.runners) {
        try { fn(); }
        catch (e) { console.error("Runner error", e); }
      }
    } catch (e) {
      console.error("Injection error", e);
    }
  }

  async function refreshCache() {
    try {
      const res = await fetch(STARBLAST_URL, { cache: "no-store" });
      const newHash =
        res.headers.get("etag") ||
        res.headers.get("last-modified") ||
        Date.now().toString();
      if (newHash !== localStorage.getItem(HASH_KEY)) {
        const src = await res.text();
        localStorage.setItem(CACHE_KEY, src);
        localStorage.setItem(HASH_KEY, newHash);
        Tetra.log("Cache refreshed");
      }
    } catch {}
  }

  async function fetchFresh() {
    const res = await fetch(STARBLAST_URL, { cache: "no-store" });
    const src = await res.text();
    const newHash =
      res.headers.get("etag") ||
      res.headers.get("last-modified") ||
      Date.now().toString();
    localStorage.setItem(CACHE_KEY, src);
    localStorage.setItem(HASH_KEY, newHash);
    Tetra.log("Fresh source fetched");
    return src;
  }
})();



(function() {
  "use strict";

  const keys = [
    ["kristal rengi","crystalColorEnabled","checkbox"],
    ["kristal rengi hud","crystalHudEnabled","checkbox"],
    ["gemi tag kristal","crystalTagEnabled","checkbox"],
    ["kristal yazısı","crystalPickupEnabled","checkbox"],
    ["kristal rengi","crystal-color","text"],
    ["emote sayısı","chat_emotes_capacity","number"],
    ["emotelar","customEmotesEnabled","checkbox"],
    ["gemi hue","hueMaterialEnabled","checkbox"],
    ["gemi tagı","selftag","checkbox"],
    ["küçükharf","accurateNameDisplayEnabled","checkbox"],
    ["boş badge","showBlankBadge","checkbox"]
  ];

  const defaults = {
    crystalColorEnabled:"false",
    crystalHudEnabled:"false",
    crystalTagEnabled:"false",
    crystalPickupEnabled:"false",
    "crystal-color":"hsla(141,100%,50%,0.75)",
    chat_emotes_capacity:"4",
    customEmotesEnabled:"false",
    hueMaterialEnabled:"false",
    selftag:"false",
    accurateNameDisplayEnabled:"false",
    showBlankBadge:"false"
  };

  // --- Modal wrapper ---
  const modal = document.createElement("div");
  modal.id = "tetra-settings";
  modal.className = "changelog-new";
  modal.style.cssText = `
    display:none;
    width: 300px;
    max-height: 80%;
    overflow-y: auto;
    position: fixed;
    top: 80px;
    left: 80px;
    z-index: 99999;
    border-radius: 12px;
    padding: 8px;
    background: hsla(200,50%,10%,.90);
    color: white;
  `;
  modal.innerHTML = `
    <div id="tetra-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; cursor:move;">
      <span style="font-weight:bold;">yarak cliet ayar</span>
      <span id="tetra-close" style="cursor:pointer;">✖</span>
    </div>
    <div class="settings-body" style="display:flex; flex-direction:column; gap:6px;">
      ${keys.map(([label,key,type]) => `
        <div class="option">
          <label style="display:flex; align-items:center; justify-content:space-between;">
            <span>${label}</span>
            ${
              type==="checkbox"
              ? `<label class="switch"><input type="checkbox" data-ls="${key}"><span class="slider"></span></label>`
              : `<input type="${type}" data-ls="${key}" style="width:${type==="text"?"140px":"60px"}; border-radius:4px; background:#222; color:white; border:none; padding:2px 4px;">`
            }
          </label>
        </div>`).join("")}
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:10px;">
      <button id="tetra-reset" class="button">Reset</button>
      <button id="tetra-apply" class="button">Apply</button>
    </div>
  `;
  document.body.appendChild(modal);

  // --- Toggle switch CSS ---
  const style = document.createElement("style");
  style.textContent = `
    .switch {
      position: relative;
      display: inline-block;
      width: 34px;
      height: 18px;
    }
    .switch input { display:none; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0;
      right: 0; bottom: 0;
      background-color: #333;
      transition: .3s;
      border-radius: 18px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px; width: 14px;
      left: 2px; bottom: 2px;
      background-color: #bbb;
      transition: .3s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: hsl(235.43deg 100% 75.22%);
    }
    input:checked + .slider:before {
      transform: translateX(16px);
      background: #fff;
    }
    .button {
      background:hsl(235.43deg 100% 75.22%);
      border:none;
      border-radius:6px;
      padding:4px 12px;
      cursor:pointer;
      color:#fff;
      font-weight:bold;
      transition:background .2s;
    }
    .button:hover {
      background:hsl(235.43deg 100% 75.22%);
    }
  `;
  document.head.appendChild(style);

  // --- Sync inputs ---
  function syncInputs() {
    modal.querySelectorAll("[data-ls]").forEach(el => {
      const key = el.dataset.ls;
      const val = localStorage.getItem(key);
      if (el.type === "checkbox") {
        el.checked = val === "true";
      } else {
        el.value = val ?? "";
      }
    });
  }
  syncInputs();

  // --- Save changes ---
  modal.addEventListener("change", e => {
    const el = e.target;
    const key = el.dataset.ls;
    if (!key) return;
    if (el.type === "checkbox") {
      localStorage.setItem(key, el.checked ? "true" : "false");
    } else {
      localStorage.setItem(key, el.value);
    }
  });

  // --- Buttons ---
  modal.querySelector("#tetra-reset").addEventListener("click", () => {
    for (const [k,v] of Object.entries(defaults)) {
      localStorage.setItem(k,v);
    }
    syncInputs();
    alert("Tetra settings reset to defaults!");
  });
modal.querySelector("#tetra-apply").addEventListener("click", () => {
    location.reload(); // reloads the page
});


  // --- Open/Close ---
  modal.querySelector("#tetra-close").addEventListener("click", () => modal.style.display="none");
  window.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase()==="m") {
      e.preventDefault();
      if (modal.style.display==="block") modal.style.display="none";
      else { syncInputs(); modal.style.display="block"; }
    }
  });

  // --- Draggable header ---
  (function makeDraggable() {
    const header = modal.querySelector("#tetra-header");
    let offsetX=0, offsetY=0, dragging=false;
    header.addEventListener("mousedown", e => {
      dragging=true;
      offsetX = e.clientX - modal.offsetLeft;
      offsetY = e.clientY - modal.offsetTop;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!dragging) return;
      modal.style.left = (e.clientX - offsetX)+"px";
      modal.style.top = (e.clientY - offsetY)+"px";
    }
    function onUp() {
      dragging=false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  })();

    (function() {
  "use strict";

  const TARGET_LOG = "[SelfShipTag] Updated all Scene references.";


})();
})();
