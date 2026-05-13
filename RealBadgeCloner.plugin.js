/**
 * @name RealBadgeCloner
 * @author Progic
 * @version 3.0.0
 * @description Adds real Discord badges to your own profile (client-side only). Toggle badges in settings.
 * @website https://github.com
 * @source https://github.com
 */

module.exports = class RealBadgeCloner {
    constructor() {
        // Updated to include native Discord icon hashes for rendering in modern profiles
        this.BADGES = [
            { id: "staff",           label: "Discord Staff",                flag: 1 << 0,  icon: "5e74e9b61934fc1f67c65515d1f7e60d" },
            { id: "partner",         label: "Partnered Server Owner",       flag: 1 << 1,  icon: "3f9748e53446a137a052f3454e2de41e" },
            { id: "hypesquad",       label: "HypeSquad Events",             flag: 1 << 2,  icon: "bf01d1073931f921909045f3a39fd264" },
            { id: "bug_hunter_1",    label: "Bug Hunter Level 1",           flag: 1 << 3,  icon: "2717692c7dca7289b35297368a940dd0" },
            { id: "bravery",         label: "HypeSquad Bravery",            flag: 1 << 6,  icon: "8a88d63823d8a71cd5e390baa45efa02" },
            { id: "brilliance",      label: "HypeSquad Brilliance",         flag: 1 << 7,  icon: "011940fd013da3f7fb926e4a1cd2e618" },
            { id: "balance",         label: "HypeSquad Balance",            flag: 1 << 8,  icon: "3aa41de486fa12454c3761e8e223442e" },
            { id: "early_supporter", label: "Early Supporter",              flag: 1 << 9,  icon: "7060786766c9c840eb3019e725d2b358" },
            { id: "bug_hunter_2",    label: "Bug Hunter Level 2",           flag: 1 << 14, icon: "84926c0deab1c83c2678619fb3e8d2e8" },
            { id: "verified_dev",    label: "Early Verified Bot Developer", flag: 1 << 17, icon: "6bdc42827a38498929a4920da12695d9" },
            { id: "mod_alumni",      label: "Moderator Programs Alumni",    flag: 1 << 18, icon: "fdd85d6883ce8e00185e495fde3d41f7" },
            { id: "active_dev",      label: "Active Developer",             flag: 1 << 22, icon: "cb8c871e4d5fbfa9fc03f90b8f596825" }
        ];
    }

    start() {
        this.patchUserStore();
        this.patchUserProfileStore();
        this.applyFlags();
        this.forceUpdateProfile();
        console.log("[RealBadgeCloner] Started — badges patched");
    }

    stop() {
        BdApi.Patcher.unpatchAll("RealBadgeCloner");

        // Clean up caches so badges disappear immediately on stop
        const UserStore = BdApi.Webpack.getStore("UserStore");
        const UserProfileStore = BdApi.Webpack.getStore("UserProfileStore");

        if (UserStore) {
            const user = UserStore.getCurrentUser();
            if (user) {
                const allMask = this.getAllFlagsMask();
                user.flags &= ~allMask;
                user.publicFlags &= ~allMask;
            }
        }
        if (UserProfileStore && UserStore) {
            const myId = UserStore.getCurrentUser()?.id;
            const profile = UserProfileStore.getUserProfile(myId);
            if (profile && profile.badges) {
                // Strip out the plugin's badges from cache
                profile.badges = profile.badges.filter(b => !this.BADGES.some(myB => myB.id === b.id));
            }
        }

        this.forceUpdateProfile();
        console.log("[RealBadgeCloner] Stopped — patches removed");
    }

    getEnabledFlagsMask() {
        let mask = 0;
        for (const badge of this.BADGES) {
            const enabled = BdApi.Data.load("RealBadgeCloner", badge.id) ?? true;
            if (enabled) mask |= badge.flag;
        }
        return mask;
    }

    getAllFlagsMask() {
        let mask = 0;
        for (const badge of this.BADGES) mask |= badge.flag;
        return mask;
    }

    /**
     * Patches UserStore for elements that still rely on basic publicFlags (like old popouts).
     */
    patchUserStore() {
        const UserStore = BdApi.Webpack.getStore("UserStore");
        if (!UserStore) return;

        const myId = UserStore.getCurrentUser()?.id;

        const patchUser = (user) => {
            if (user && user.id === myId) {
                const mask = this.getEnabledFlagsMask();
                const allMask = this.getAllFlagsMask();
                // Clear plugin flags, then apply currently enabled ones
                user.flags = (user.flags & ~allMask) | mask;
                user.publicFlags = (user.publicFlags & ~allMask) | mask;
            }
            return user;
        };

        BdApi.Patcher.after("RealBadgeCloner", UserStore, "getCurrentUser", (_, __, ret) => patchUser(ret));
        BdApi.Patcher.after("RealBadgeCloner", UserStore, "getUser", (_, __, ret) => patchUser(ret));
    }

    /**
     * Patches UserProfileStore to inject real badges directly into modern profile/modal badge arrays.
     */
    patchUserProfileStore() {
        const UserProfileStore = BdApi.Webpack.getStore("UserProfileStore");
        const UserStore = BdApi.Webpack.getStore("UserStore");
        if (!UserProfileStore || !UserStore) return;

        BdApi.Patcher.after("RealBadgeCloner", UserProfileStore, "getUserProfile", (_, args, ret) => {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return ret;

            const targetUserId = args[0];
            if (ret && targetUserId === currentUser.id) {
                // Remove all badges controlled by this plugin from the cache to prevent duplication/sticking
                const newBadges = (ret.badges || []).filter(b => !this.BADGES.some(myB => myB.id === b.id));

                // Add currently toggled badges
                for (const badge of this.BADGES) {
                    const enabled = BdApi.Data.load("RealBadgeCloner", badge.id) ?? true;
                    if (enabled) {
                        newBadges.push({
                            id: badge.id,
                            description: badge.label,
                            icon: badge.icon
                        });
                    }
                }
                ret.badges = newBadges;
            }
            return ret;
        });
    }

    forceUpdateProfile() {
        try {
            const UserStore = BdApi.Webpack.getStore("UserStore");
            if (UserStore && UserStore.emitChange) UserStore.emitChange();

            const UserProfileStore = BdApi.Webpack.getStore("UserProfileStore");
            if (UserProfileStore && UserProfileStore.emitChange) UserProfileStore.emitChange();
        } catch (e) {
            // Ignore non-critical UI update errors
        }
    }

    applyFlags() {
        try {
            const UserStore = BdApi.Webpack.getStore("UserStore");
            if (UserStore) {
                const user = UserStore.getCurrentUser();
                if (user) {
                    const mask = this.getEnabledFlagsMask();
                    const allMask = this.getAllFlagsMask();
                    user.flags = (user.flags & ~allMask) | mask;
                    user.publicFlags = (user.publicFlags & ~allMask) | mask;
                }
            }
        } catch (e) {
            console.error("[RealBadgeCloner] Error applying flags:", e);
        }
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "16px";
        panel.style.color = "var(--text-normal, #dcddde)";
        panel.style.fontFamily = "var(--font-primary, 'gg sans', 'Noto Sans', sans-serif)";

        const title = document.createElement("h2");
        title.textContent = "Badge Toggles";
        title.style.marginBottom = "12px";
        title.style.fontSize = "16px";
        title.style.fontWeight = "600";
        title.style.color = "var(--header-primary, #fff)";
        panel.appendChild(title);

        const desc = document.createElement("p");
        desc.textContent = "Toggle which badges appear on your profile. Changes apply immediately (client-side only).";
        desc.style.marginBottom = "16px";
        desc.style.fontSize = "13px";
        desc.style.color = "var(--text-muted, #a3a6aa)";
        panel.appendChild(desc);

        for (const badge of this.BADGES) {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.marginBottom = "10px";
            row.style.padding = "8px 12px";
            row.style.borderRadius = "8px";
            row.style.backgroundColor = "var(--background-secondary, #2f3136)";

            const switchContainer = document.createElement("div");
            switchContainer.style.position = "relative";
            switchContainer.style.width = "40px";
            switchContainer.style.height = "24px";
            switchContainer.style.flexShrink = "0";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.style.opacity = "0";
            checkbox.style.width = "0";
            checkbox.style.height = "0";
            checkbox.style.position = "absolute";

            const savedVal = BdApi.Data.load("RealBadgeCloner", badge.id);
            checkbox.checked = savedVal === null || savedVal === undefined || savedVal === true;

            const slider = document.createElement("span");
            slider.style.position = "absolute";
            slider.style.cursor = "pointer";
            slider.style.top = "0";
            slider.style.left = "0";
            slider.style.right = "0";
            slider.style.bottom = "0";
            slider.style.borderRadius = "12px";
            slider.style.transition = "background-color 0.2s";
            slider.style.backgroundColor = checkbox.checked
                ? "var(--brand-500, #5865f2)"
                : "var(--background-modifier-accent, #4f545c)";

            const dot = document.createElement("span");
            dot.style.position = "absolute";
            dot.style.height = "18px";
            dot.style.width = "18px";
            dot.style.left = checkbox.checked ? "19px" : "3px";
            dot.style.bottom = "3px";
            dot.style.borderRadius = "50%";
            dot.style.backgroundColor = "#fff";
            dot.style.transition = "left 0.2s";
            slider.appendChild(dot);

            checkbox.addEventListener("change", () => {
                BdApi.Data.save("RealBadgeCloner", badge.id, checkbox.checked);
                slider.style.backgroundColor = checkbox.checked
                    ? "var(--brand-500, #5865f2)"
                    : "var(--background-modifier-accent, #4f545c)";
                dot.style.left = checkbox.checked ? "19px" : "3px";

                this.applyFlags();
                this.forceUpdateProfile();
            });

            switchContainer.appendChild(checkbox);
            switchContainer.appendChild(slider);
            switchContainer.addEventListener("click", () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            });

            const label = document.createElement("span");
            label.textContent = badge.label;
            label.style.marginLeft = "12px";
            label.style.fontSize = "14px";
            label.style.userSelect = "none";
            label.style.cursor = "pointer";
            label.addEventListener("click", () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            });

            row.appendChild(switchContainer);
            row.appendChild(label);
            panel.appendChild(row);
        }

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.gap = "8px";
        btnRow.style.marginTop = "12px";

        const makeBtn = (text, enable) => {
            const btn = document.createElement("button");
            btn.textContent = text;
            btn.style.padding = "8px 16px";
            btn.style.borderRadius = "4px";
            btn.style.border = "none";
            btn.style.cursor = "pointer";
            btn.style.fontSize = "13px";
            btn.style.fontWeight = "600";
            btn.style.color = "#fff";
            btn.style.backgroundColor = enable
                ? "var(--brand-500, #5865f2)"
                : "var(--button-danger-background, #ed4245)";
            
            btn.addEventListener("mouseenter", () => btn.style.filter = "brightness(1.1)");
            btn.addEventListener("mouseleave", () => btn.style.filter = "");
            
            btn.addEventListener("click", () => {
                for (const badge of this.BADGES) {
                    BdApi.Data.save("RealBadgeCloner", badge.id, enable);
                }
                this.applyFlags();
                this.forceUpdateProfile();
                panel.replaceWith(this.getSettingsPanel());
            });
            return btn;
        };

        btnRow.appendChild(makeBtn("Enable All", true));
        btnRow.appendChild(makeBtn("Disable All", false));
        panel.appendChild(btnRow);

        return panel;
    }
};