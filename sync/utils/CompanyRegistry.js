const fs = require('fs-extra');
const path = require('path');
const CONFIG = require('../config');
const Logger = require('./Logger');

class CompanyRegistry {
    constructor() {
        this.registryFile = path.join(CONFIG.PATHS.OUTPUT_DATA, 'companies.json');
    }

    async getCompanies() {
        try {
            if (await fs.pathExists(this.registryFile)) {
                return await fs.readJson(this.registryFile);
            }
        } catch (e) {
            Logger.error("Failed to read companies.json", e);
        }
        return [];
    }

    async register(id, name) {
        let companies = await this.getCompanies();
        const existing = companies.find(c => c.id === id);

        if (existing) {
            existing.lastUpdated = new Date().toISOString();
            existing.name = name; // Update name in case it changed slightly
        } else {
            companies.push({
                id: id,
                name: name,
                lastUpdated: new Date().toISOString()
            });
        }

        try {
            await fs.writeJson(this.registryFile, companies, { spaces: 2 });
            Logger.success(`Registered company: ${name} (${id})`);
        } catch (e) {
            Logger.error("Failed to update companies.json", e);
        }
    }

    /**
     * Finds a company ID by Tally Name substring match
     */
    findExistingId(tallyName) {
        // This is tricky because we don't have the companies list here synchronously easily
        // But auto_sync.js can handle the logic
    }
}

module.exports = new CompanyRegistry();
