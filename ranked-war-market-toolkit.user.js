// ==UserScript==
// @name         Ranked War Toolkit
// @namespace    http://tampermonkey.net/
// @version      2.2.3
// @description  Ranked War toolkit: Market Lister, Cache Prices, and Buy Quotes
// @author       Scolli03[3150751], GeneralMatter
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const API_KEY = '###PDA-APIKEY###';
    const API_BASE = 'https://api.torn.com/v2';
    const WEAV3R_API = 'https://weav3r.dev/api/marketplace';
    const PRICE_DISCOUNT = 0.05; // 5% discount
    const CACHE_PRICE_DISCOUNT = 1000000; // 1 million
    const CACHE_MARGIN_PERCENT = 0.03; // 3% margin

    // Ranked war weapon and armor item IDs
    // These are the item IDs for ranked war weapons and armor in Torn
    // You may need to update these based on current game items
    const RANKED_WAR_WEAPONS = [
        // Add weapon IDs here - these are examples and need to be verified
        // Common ranked war weapons include various melee and ranged weapons
    ];

    const RANKED_WAR_ARMOR = [
        // Add armor IDs here - these are examples and need to be verified
        // Common ranked war armor includes various protective gear
    ];

    // Item type categories for ranked war items
    // Based on Torn's item system, ranked war items typically have specific type values
    const RANKED_WAR_TYPES = {
        WEAPON: ['Melee', 'Ranged', 'Temporary'],
        ARMOR: ['Armor', 'Helmet', 'Gloves', 'Boots']
    };

    // Helper function to check if item is ranked war weapon or armor
    function isRankedWarItem(item) {
        const itemId = item.id || item.ID || item.item_id;
        const name = (item.name || '').toLowerCase();
        const type = (item.type || item.category || '').toLowerCase();
        const stats = item.stats || {};
        const bonuses = item.bonuses || [];
        
        // Check by item ID if available
        if (itemId && (RANKED_WAR_WEAPONS.includes(parseInt(itemId)) || RANKED_WAR_ARMOR.includes(parseInt(itemId)))) {
            return true;
        }
        
        // Check by item name patterns (ranked war items often have specific naming)
        // Common patterns: "Ranked War", "RW ", "Ranked War Weapon", "Ranked War Armor"
        if (name.includes('ranked war') || 
            name.includes('rw ') || 
            name.startsWith('rw ') ||
            name.includes('rankedwar')) {
            return true;
        }
        
        // Check by item type - Primary, Secondary, Melee, or Defensive with quality/bonus stats
        // Ranked war items are weapons (Primary, Secondary, Melee) or armor (Defensive) with quality/bonus modifiers
        const hasQuality = stats.quality !== undefined && stats.quality !== null;
        const hasBonuses = bonuses.length > 0;
        
        if (hasQuality || hasBonuses) {
            // Check if it's a weapon type (Primary, Secondary, Melee)
            if (type === 'primary' || type === 'secondary' || type === 'melee') {
                return true;
            }
            // Check if it's armor type (Defensive)
            if (type === 'defensive') {
                return true;
            }
            // Also check for weapon/armor patterns in type
            if (RANKED_WAR_TYPES.WEAPON.some(t => type.includes(t.toLowerCase())) ||
                RANKED_WAR_TYPES.ARMOR.some(t => type.includes(t.toLowerCase()))) {
                return true;
            }
        }
        
        return false;
    }
    
    // Helper function to determine if item is weapon or armor
    function isWeapon(item) {
        const type = (item.type || '').toLowerCase();
        return type === 'primary' || type === 'secondary' || type === 'melee';
    }
    
    // Helper function to determine if item is armor
    function isArmor(item) {
        const type = (item.type || '').toLowerCase();
        return type === 'defensive';
    }

    // Fetch user's item market listings
    async function fetchItemMarket(offset = 0) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/user/itemmarket?offset=${offset}`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `ApiKey ${API_KEY}`,
                    'User-Agent': 'TornPDA-UserScript/1.0'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(new Error(data.error.error || data.error));
                            return;
                        }
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Process and filter items
    function processItems(marketData) {
        const itemmarket = marketData.itemmarket || [];
        const marketItems = [];
        
        for (const listing of itemmarket) {
            const item = listing.item || {};
            const stats = item.stats || {};
            const bonuses = item.bonuses || [];
            
            // Check if it's a ranked war item
            if (!isRankedWarItem(item)) {
                continue;
            }
            
            const listedPrice = listing.price || 0;
            const adjustedPrice = Math.floor(listedPrice * (1 - PRICE_DISCOUNT));
            
            // Format bonuses as a string with % unless it's Disarm (which is T)
            let bonusText = 'N/A';
            if (bonuses.length > 0) {
                bonusText = bonuses.map(b => {
                    const title = b.title || '';
                    const value = b.value || 0;
                    // If it's Disarm, use T instead of %
                    if (title.toLowerCase().includes('disarm')) {
                        return `${title}: ${value}T`;
                    }
                    return `${title}: ${value}%`;
                }).join(', ');
            } else if (stats.quality !== undefined) {
                // If no bonuses array, use quality as bonus indicator
                bonusText = stats.quality.toString();
            }
            
            // Determine category based on item type
            const itemType = (item.type || '').toLowerCase();
            let category = 'Unknown';
            let itemCategory = 'Unknown'; // 'Weapon' or 'Armor'
            let armorSet = 'N/A'; // Initialize for all items, will be set for armor items
            
            if (isWeapon(item)) {
                itemCategory = 'Weapon';
                // Check if type matches directly (case-insensitive)
                if (itemType === 'primary') {
                    category = 'Primary';
                } else if (itemType === 'secondary') {
                    category = 'Secondary';
                } else if (itemType === 'melee') {
                    category = 'Melee';
                } else if (itemType) {
                    // Fallback: check if type contains the category name
                    if (itemType.includes('primary')) {
                        category = 'Primary';
                    } else if (itemType.includes('secondary')) {
                        category = 'Secondary';
                    } else if (itemType.includes('melee')) {
                        category = 'Melee';
                    }
                }
            } else if (isArmor(item)) {
                itemCategory = 'Armor';
                // For armor, use the item name to determine category (Body, Boots, Helmet, Gloves, Pants, etc.)
                const itemName = (item.name || '').toLowerCase();
                armorSet = 'Unknown'; // Reset for armor items
                
                // Extract armor set name (Assault, Riot, etc.)
                const itemNameOriginal = (item.name || '');
                if (itemNameOriginal.toLowerCase().includes('assault')) {
                    armorSet = 'Assault';
                } else if (itemNameOriginal.toLowerCase().includes('riot')) {
                    armorSet = 'Riot';
                } else if (itemNameOriginal.toLowerCase().includes('dune')) {
                    armorSet = 'Dune';
                } else if (itemNameOriginal.toLowerCase().includes('tactical')) {
                    armorSet = 'Tactical';
                } else if (itemNameOriginal.toLowerCase().includes('combat')) {
                    armorSet = 'Combat';
                } else if (itemNameOriginal.toLowerCase().includes('military')) {
                    armorSet = 'Military';
                } else if (itemNameOriginal.toLowerCase().includes('stealth')) {
                    armorSet = 'Stealth';
                } else if (itemNameOriginal.toLowerCase().includes('urban')) {
                    armorSet = 'Urban';
                } else if (itemNameOriginal.toLowerCase().includes('desert')) {
                    armorSet = 'Desert';
                } else if (itemNameOriginal.toLowerCase().includes('arctic')) {
                    armorSet = 'Arctic';
                } else if (itemNameOriginal.toLowerCase().includes('jungle')) {
                    armorSet = 'Jungle';
                }
                
                if (itemName.includes('body') || itemName.includes('vest') || itemName.includes('chest')) {
                    category = 'Body';
                } else if (itemName.includes('boot') || itemName.includes('shoe')) {
                    category = 'Boots';
                } else if (itemName.includes('helmet') || itemName.includes('hat') || itemName.includes('cap')) {
                    category = 'Helmet';
                } else if (itemName.includes('glove') || itemName.includes('hand')) {
                    category = 'Gloves';
                } else if (itemName.includes('pant') || itemName.includes('trouser') || itemName.includes('leg')) {
                    category = 'Pants';
                } else {
                    category = 'Armor';
                }
            }
            
            // Debug: log if category is still Unknown
            if (category === 'Unknown' && itemType) {
                console.log('Unknown category for item:', item.name, 'type:', item.type, 'itemType:', itemType);
            }
            
            marketItems.push({
                id: item.id || listing.id,
                name: item.name || 'Unknown',
                quality: stats.quality !== undefined ? stats.quality : 'N/A',
                bonus: bonusText,
                listedPrice: listedPrice,
                adjustedPrice: adjustedPrice,
                // Additional stats
                damage: stats.damage !== undefined ? stats.damage : 'N/A',
                accuracy: stats.accuracy !== undefined ? stats.accuracy : 'N/A',
                defense: stats.armor !== undefined ? stats.armor : 'N/A',
                type: item.type || 'Unknown',
                category: category,
                armorSet: armorSet, // Store armor set name (N/A for weapons, set name or Unknown for armor)
                itemCategory: itemCategory, // 'Weapon' or 'Armor'
                rarity: item.rarity || 'Unknown',
                available: listing.available || 0
            });
        }
        
        // Return unsorted items - sorting will be done after all pages are collected
        return marketItems;
    }

    // Format number with commas
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Generate forum table format (BBCode) - Torn City format
    function generateForumTable(items) {
        // Torn City BBCode table format: each tag on its own line
        let table = '[table]\n';
        
        // Header row - same format as data rows, using [td] instead of [th]
        table += '[tr]\n';
        table += '[td]Item Name[/td]\n';
        table += '[td]Quality[/td]\n';
        table += '[td]Bonus[/td]\n';
        table += '[td]Listed Price[/td]\n';
        table += '[td]Price (-5%)[/td]\n';
        table += '[/tr]\n';
        
        items.forEach(item => {
            // Each data row - each tag on its own line
            table += '[tr]\n';
            table += `[td]${item.name}[/td]\n`;
            table += `[td]${item.quality}[/td]\n`;
            table += `[td]${item.bonus}[/td]\n`;
            table += `[td]$${formatNumber(item.listedPrice)}[/td]\n`;
            table += `[td]$${formatNumber(item.adjustedPrice)}[/td]\n`;
            table += '[/tr]\n';
        });
        
        table += '[/table]';
        return table;
    }

    // Generate HTML table for weapons
    function generateWeaponHTMLTable(items, includeListedPrice = false) {
        let html = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
        html += '<thead><tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Item Name</th>';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Dmg/Acc/Qual</th>';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Bonus</th>';
        if (includeListedPrice) {
            html += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Listed Price</th>';
        }
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Price</th>';
        html += '</tr></thead><tbody>';
        
        let currentCategory = '';
        let rowIndex = 0;
        items.forEach((item) => {
            // Add category header row if category changed
            if (item.category !== currentCategory) {
                currentCategory = item.category;
                html += `<tr style="background-color: #1a1a1a;">`;
                html += `<td colspan="${includeListedPrice ? '5' : '4'}" style="padding: 8px; border: 1px solid #444; color: #d97706; font-weight: bold; text-align: center;">${currentCategory}</td>`;
                html += '</tr>';
            }
            
            const bgColor = rowIndex % 2 === 0 ? '#2d2d2d' : '#353535';
            rowIndex++;
            // Format Dmg/Acc/Qual with spacing and different colors
            const dmg = item.damage !== 'N/A' ? item.damage : '-';
            const acc = item.accuracy !== 'N/A' ? item.accuracy : '-';
            const qual = item.quality !== 'N/A' ? item.quality : '-';
            
            // Map rarity to color: yellow, orange, or red
            let qualityColor = '#f5f5f5'; // default white
            let rarityLetter = '';
            const rarity = (item.rarity || '').toLowerCase();
            if (rarity === 'yellow') {
                qualityColor = '#fbbf24'; // yellow
                rarityLetter = 'Y';
            } else if (rarity === 'orange') {
                qualityColor = '#fb923c'; // orange
                rarityLetter = 'O';
            } else if (rarity === 'red') {
                qualityColor = '#ef4444'; // red
                rarityLetter = 'R';
            }
            
            // Format quality with rarity letter suffix
            const qualDisplay = qual !== '-' ? `${qual}${rarityLetter}` : qual;
            
            // Use different colors: damage (purple), accuracy (blue/cyan), quality (based on rarity)
            const statsText = `<span style="color: #a78bfa; margin-right: 8px;">${dmg}</span><span style="color: #4dabf7; margin-right: 8px;">${acc}</span><span style="color: ${qualityColor};">${qualDisplay}</span>`;
            
            html += `<tr style="background-color: ${bgColor}; color: #f5f5f5;">`;
            html += `<td style="padding: 8px; border: 1px solid #444; color: ${qualityColor};">${item.name}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${statsText}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${item.bonus}</td>`;
            if (includeListedPrice) {
                html += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7;">$${formatNumber(item.listedPrice)}</td>`;
            }
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7; font-weight: bold;">$${formatNumber(item.adjustedPrice)}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    // Generate HTML table for armor
    function generateArmorHTMLTable(items, includeListedPrice = false, sortBy = 'type') {
        let html = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
        html += '<thead><tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Item Name</th>';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Armor/Qual</th>';
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Bonus</th>';
        if (includeListedPrice) {
            html += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Listed Price</th>';
        }
        html += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Price</th>';
        html += '</tr></thead><tbody>';
        
        let currentHeader = '';
        let rowIndex = 0;
        items.forEach((item) => {
            // Determine header based on sort mode
            const headerValue = sortBy === 'set' ? item.armorSet : item.category;
            
            // Add category/set header row if changed
            if (headerValue !== currentHeader) {
                currentHeader = headerValue;
                html += `<tr style="background-color: #1a1a1a;">`;
                html += `<td colspan="${includeListedPrice ? '5' : '4'}" style="padding: 8px; border: 1px solid #444; color: #d97706; font-weight: bold; text-align: center;">${currentHeader}</td>`;
                html += '</tr>';
            }
            
            const bgColor = rowIndex % 2 === 0 ? '#2d2d2d' : '#353535';
            rowIndex++;
            // Format Armor/Qual
            const armor = item.defense !== 'N/A' ? item.defense : '-';
            const qual = item.quality !== 'N/A' ? item.quality : '-';
            
            // Map rarity to color: yellow, orange, or red
            let qualityColor = '#f5f5f5'; // default white
            let rarityLetter = '';
            const rarity = (item.rarity || '').toLowerCase();
            if (rarity === 'yellow') {
                qualityColor = '#fbbf24'; // yellow
                rarityLetter = 'Y';
            } else if (rarity === 'orange') {
                qualityColor = '#fb923c'; // orange
                rarityLetter = 'O';
            } else if (rarity === 'red') {
                qualityColor = '#ef4444'; // red
                rarityLetter = 'R';
            }
            
            // Format quality with rarity letter suffix
            const qualDisplay = qual !== '-' ? `${qual}${rarityLetter}` : qual;
            
            // Use different colors: armor (green), quality (based on rarity)
            const statsText = `<span style="color: #10b981; margin-right: 8px;">${armor}</span><span style="color: ${qualityColor};">${qualDisplay}</span>`;
            
            html += `<tr style="background-color: ${bgColor}; color: #f5f5f5;">`;
            html += `<td style="padding: 8px; border: 1px solid #444; color: ${qualityColor};">${item.name}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${statsText}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${item.bonus}</td>`;
            if (includeListedPrice) {
                html += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7;">$${formatNumber(item.listedPrice)}</td>`;
            }
            html += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7; font-weight: bold;">$${formatNumber(item.adjustedPrice)}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }

    // Create and show modal
    function showModal(weapons, armor) {
        // Remove existing modal if present
        const existingModal = document.getElementById('rw-market-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'rw-market-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        `;

        // Modal header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        const title = document.createElement('h2');
        const totalItems = weapons.length + armor.length;
        title.textContent = `Ranked War Market Items (${totalItems})`;
        title.style.cssText = 'margin: 0; color: #d97706; font-weight: bold;';
        
        // Tab container
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #444;';
        
        let activeTab = 'weapons'; // Default to weapons
        
        const weaponsTab = document.createElement('button');
        weaponsTab.textContent = `⚔️ Weapons (${weapons.length})`;
        weaponsTab.style.cssText = `
            padding: 10px 20px;
            background-color: ${activeTab === 'weapons' ? '#d97706' : '#444'};
            color: ${activeTab === 'weapons' ? '#ffffff' : '#d97706'};
            border: none;
            border-bottom: ${activeTab === 'weapons' ? '3px solid #d97706' : '3px solid transparent'};
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        weaponsTab.onclick = () => {
            activeTab = 'weapons';
            weaponsTab.style.backgroundColor = '#d97706';
            weaponsTab.style.color = '#ffffff';
            weaponsTab.style.borderBottom = '3px solid #d97706';
            armorTab.style.backgroundColor = '#444';
            armorTab.style.color = '#d97706';
            armorTab.style.borderBottom = '3px solid transparent';
        };
        
        const armorTab = document.createElement('button');
        armorTab.textContent = `🛡️ Armor (${armor.length})`;
        armorTab.style.cssText = `
            padding: 10px 20px;
            background-color: ${activeTab === 'armor' ? '#d97706' : '#444'};
            color: ${activeTab === 'armor' ? '#ffffff' : '#d97706'};
            border: none;
            border-bottom: ${activeTab === 'armor' ? '3px solid #d97706' : '3px solid transparent'};
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        armorTab.onclick = () => {
            activeTab = 'armor';
            armorTab.style.backgroundColor = '#d97706';
            armorTab.style.color = '#ffffff';
            armorTab.style.borderBottom = '3px solid #d97706';
            weaponsTab.style.backgroundColor = '#444';
            weaponsTab.style.color = '#d97706';
            weaponsTab.style.borderBottom = '3px solid transparent';
        };
        
        tabContainer.appendChild(weaponsTab);
        tabContainer.appendChild(armorTab);
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            line-height: 1;
            transition: background-color 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#c0392b';
        closeBtn.onmouseout = () => closeBtn.style.backgroundColor = '#e74c3c';
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Options container (checkbox for Listed Price and discount percentage)
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 12px;';
        
        // Discount percentage input
        const discountRow = document.createElement('div');
        discountRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        
        const discountLabel = document.createElement('label');
        discountLabel.textContent = 'Discount Percentage:';
        discountLabel.style.cssText = 'color: #f5f5f5; font-weight: bold; min-width: 150px;';
        
        const discountInput = document.createElement('input');
        discountInput.type = 'number';
        discountInput.min = '0';
        discountInput.max = '100';
        discountInput.step = '0.1';
        discountInput.value = PRICE_DISCOUNT * 100; // Convert to percentage
        discountInput.style.cssText = `
            width: 80px;
            padding: 6px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            font-size: 14px;
        `;
        
        const discountPercentLabel = document.createElement('span');
        discountPercentLabel.textContent = '%';
        discountPercentLabel.style.cssText = 'color: #f5f5f5;';
        
        discountRow.appendChild(discountLabel);
        discountRow.appendChild(discountInput);
        discountRow.appendChild(discountPercentLabel);
        
        // Checkbox for Listed Price
        const checkboxRow = document.createElement('div');
        checkboxRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        
        const includeListedPriceCheckbox = document.createElement('input');
        includeListedPriceCheckbox.type = 'checkbox';
        includeListedPriceCheckbox.id = 'include-listed-price';
        includeListedPriceCheckbox.checked = false; // Default to false (exclude)
        includeListedPriceCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        
        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = 'include-listed-price';
        checkboxLabel.textContent = 'Include Listed Price column';
        checkboxLabel.style.cssText = 'color: #f5f5f5; cursor: pointer; user-select: none;';
        
        checkboxRow.appendChild(includeListedPriceCheckbox);
        checkboxRow.appendChild(checkboxLabel);
        
        // Armor sort mode toggle (only visible when armor tab is active)
        const armorSortRow = document.createElement('div');
        armorSortRow.id = 'armor-sort-row';
        armorSortRow.style.cssText = 'display: none; flex-direction: column; gap: 10px; padding: 10px; background-color: #2d2d2d; border-radius: 5px;';
        
        const armorSortLabel = document.createElement('span');
        armorSortLabel.textContent = 'Sort Armor By:';
        armorSortLabel.style.cssText = 'color: #f5f5f5; font-weight: bold;';
        
        const armorSortOptions = document.createElement('div');
        armorSortOptions.style.cssText = 'display: flex; gap: 20px; align-items: center;';
        
        const sortByTypeRadio = document.createElement('input');
        sortByTypeRadio.type = 'radio';
        sortByTypeRadio.name = 'armor-sort';
        sortByTypeRadio.id = 'sort-by-type';
        sortByTypeRadio.value = 'type';
        sortByTypeRadio.checked = true; // Default to type
        sortByTypeRadio.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        
        const sortByTypeLabel = document.createElement('label');
        sortByTypeLabel.htmlFor = 'sort-by-type';
        sortByTypeLabel.textContent = 'Type (Body, Boots, etc.)';
        sortByTypeLabel.style.cssText = 'color: #f5f5f5; cursor: pointer; user-select: none;';
        
        const sortBySetRadio = document.createElement('input');
        sortBySetRadio.type = 'radio';
        sortBySetRadio.name = 'armor-sort';
        sortBySetRadio.id = 'sort-by-set';
        sortBySetRadio.value = 'set';
        sortBySetRadio.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        
        const sortBySetLabel = document.createElement('label');
        sortBySetLabel.htmlFor = 'sort-by-set';
        sortBySetLabel.textContent = 'Set (Assault, Riot, etc.)';
        sortBySetLabel.style.cssText = 'color: #f5f5f5; cursor: pointer; user-select: none;';
        
        armorSortOptions.appendChild(sortByTypeRadio);
        armorSortOptions.appendChild(sortByTypeLabel);
        armorSortOptions.appendChild(sortBySetRadio);
        armorSortOptions.appendChild(sortBySetLabel);
        
        armorSortRow.appendChild(armorSortLabel);
        armorSortRow.appendChild(armorSortOptions);
        
        optionsContainer.appendChild(discountRow);
        optionsContainer.appendChild(checkboxRow);
        optionsContainer.appendChild(armorSortRow);

        // Table container
        const tableContainer = document.createElement('div');
        let armorSortMode = 'type'; // Default to sorting by type
        
        const updateTable = () => {
            const discountPercent = parseFloat(discountInput.value) || 0;
            const discount = discountPercent / 100;
            const includeListedPrice = includeListedPriceCheckbox.checked;
            
            // Show/hide armor sort options based on active tab
            if (activeTab === 'armor') {
                armorSortRow.style.display = 'flex';
            } else {
                armorSortRow.style.display = 'none';
            }
            
            if (activeTab === 'weapons') {
                // Recalculate adjusted prices with new discount
                const itemsWithDiscount = weapons.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                tableContainer.innerHTML = generateWeaponHTMLTable(itemsWithDiscount, includeListedPrice);
            } else {
                // Get current sort mode
                armorSortMode = document.querySelector('input[name="armor-sort"]:checked')?.value || 'type';
                
                // Sort armor based on selected mode
                let sortedArmor = [...armor];
                if (armorSortMode === 'set') {
                    // Sort by set first, then by type within set, then by price
                    const setOrder = { 'Assault': 1, 'Riot': 2, 'Dune': 3, 'Tactical': 4, 'Combat': 5, 'Military': 6, 'Stealth': 7, 'Urban': 8, 'Desert': 9, 'Arctic': 10, 'Jungle': 11, 'Unknown': 12 };
                    const typeOrder = { 'Body': 1, 'Boots': 2, 'Helmet': 3, 'Gloves': 4, 'Pants': 5, 'Armor': 6 };
                    sortedArmor.sort((a, b) => {
                        const setA = setOrder[a.armorSet] || 12;
                        const setB = setOrder[b.armorSet] || 12;
                        if (setA !== setB) {
                            return setA - setB;
                        }
                        const typeA = typeOrder[a.category] || 6;
                        const typeB = typeOrder[b.category] || 6;
                        if (typeA !== typeB) {
                            return typeA - typeB;
                        }
                        return b.listedPrice - a.listedPrice;
                    });
                } else {
                    // Sort by type (already sorted in main function, but recalculate prices)
                }
                
                // Recalculate adjusted prices with new discount
                const itemsWithDiscount = sortedArmor.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                tableContainer.innerHTML = generateArmorHTMLTable(itemsWithDiscount, includeListedPrice, armorSortMode);
            }
        };
        updateTable();
        // Wrap tab click handlers to call updateTable
        const originalWeaponsClick = weaponsTab.onclick;
        weaponsTab.onclick = () => {
            if (originalWeaponsClick) originalWeaponsClick();
            updateTable();
        };
        
        const originalArmorClick = armorTab.onclick;
        armorTab.onclick = () => {
            if (originalArmorClick) originalArmorClick();
            updateTable();
        };
        
        includeListedPriceCheckbox.addEventListener('change', updateTable);
        discountInput.addEventListener('input', updateTable);
        sortByTypeRadio.addEventListener('change', updateTable);
        sortBySetRadio.addEventListener('change', updateTable);

        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;';

        // Copy HTML button
        const copyHTMLBtn = document.createElement('button');
        copyHTMLBtn.textContent = 'Copy HTML Table';
        copyHTMLBtn.style.cssText = `
            padding: 10px 20px;
            background-color: #444;
            color: #d97706;
            border: 1px solid #d97706;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        copyHTMLBtn.onmouseover = () => {
            copyHTMLBtn.style.backgroundColor = '#d97706';
            copyHTMLBtn.style.color = '#ffffff';
        };
        copyHTMLBtn.onmouseout = () => {
            copyHTMLBtn.style.backgroundColor = '#444';
            copyHTMLBtn.style.color = '#d97706';
        };
        copyHTMLBtn.onclick = () => {
            const discountPercent = parseFloat(discountInput.value) || 0;
            const discount = discountPercent / 100;
            const includeListedPrice = includeListedPriceCheckbox.checked;
            
            let html;
            if (activeTab === 'weapons') {
                const itemsWithDiscount = weapons.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                html = generateWeaponHTMLTable(itemsWithDiscount, includeListedPrice);
            } else {
                // Get current sort mode
                const currentSortMode = document.querySelector('input[name="armor-sort"]:checked')?.value || 'type';
                
                // Sort armor based on selected mode (same logic as updateTable)
                let sortedArmor = [...armor];
                if (currentSortMode === 'set') {
                    const setOrder = { 'Assault': 1, 'Riot': 2, 'Dune': 3, 'Tactical': 4, 'Combat': 5, 'Military': 6, 'Stealth': 7, 'Urban': 8, 'Desert': 9, 'Arctic': 10, 'Jungle': 11, 'Unknown': 12 };
                    const typeOrder = { 'Body': 1, 'Boots': 2, 'Helmet': 3, 'Gloves': 4, 'Pants': 5, 'Armor': 6 };
                    sortedArmor.sort((a, b) => {
                        const setA = setOrder[a.armorSet] || 12;
                        const setB = setOrder[b.armorSet] || 12;
                        if (setA !== setB) {
                            return setA - setB;
                        }
                        const typeA = typeOrder[a.category] || 6;
                        const typeB = typeOrder[b.category] || 6;
                        if (typeA !== typeB) {
                            return typeA - typeB;
                        }
                        return b.listedPrice - a.listedPrice;
                    });
                }
                
                const itemsWithDiscount = sortedArmor.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                html = generateArmorHTMLTable(itemsWithDiscount, includeListedPrice, currentSortMode);
            }
            GM_setClipboard(html, 'text');
            copyHTMLBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyHTMLBtn.textContent = 'Copy HTML Table';
            }, 2000);
        };

        // Copy CSV button
        const copyCSVBtn = document.createElement('button');
        copyCSVBtn.textContent = 'Copy CSV';
        copyCSVBtn.style.cssText = `
            padding: 10px 20px;
            background-color: #444;
            color: #d97706;
            border: 1px solid #d97706;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        copyCSVBtn.onmouseover = () => {
            copyCSVBtn.style.backgroundColor = '#d97706';
            copyCSVBtn.style.color = '#ffffff';
        };
        copyCSVBtn.onmouseout = () => {
            copyCSVBtn.style.backgroundColor = '#444';
            copyCSVBtn.style.color = '#d97706';
        };
        copyCSVBtn.onclick = () => {
            const discountPercent = parseFloat(discountInput.value) || 0;
            const discount = discountPercent / 100;
            const includeListedPrice = includeListedPriceCheckbox.checked;
            
            let csv;
            if (activeTab === 'weapons') {
                csv = 'Item Name,Dmg/Acc/Qual,Bonus';
                if (includeListedPrice) {
                    csv += ',Listed Price';
                }
                csv += ',Price\n';
                
                weapons.forEach(item => {
                    const dmg = item.damage !== 'N/A' ? item.damage : '-';
                    const acc = item.accuracy !== 'N/A' ? item.accuracy : '-';
                    const qual = item.quality !== 'N/A' ? item.quality : '-';
                    const statsText = `${dmg} / ${acc} / ${qual}`;
                    const adjustedPrice = Math.floor(item.listedPrice * (1 - discount));
                    
                    csv += `"${item.name}","${statsText}","${item.bonus}"`;
                    if (includeListedPrice) {
                        csv += `,${item.listedPrice}`;
                    }
                    csv += `,${adjustedPrice}\n`;
                });
            } else {
                // Get current sort mode and sort armor accordingly
                const currentSortMode = document.querySelector('input[name="armor-sort"]:checked')?.value || 'type';
                let sortedArmor = [...armor];
                if (currentSortMode === 'set') {
                    const setOrder = { 'Assault': 1, 'Riot': 2, 'Dune': 3, 'Tactical': 4, 'Combat': 5, 'Military': 6, 'Stealth': 7, 'Urban': 8, 'Desert': 9, 'Arctic': 10, 'Jungle': 11, 'Unknown': 12 };
                    const typeOrder = { 'Body': 1, 'Boots': 2, 'Helmet': 3, 'Gloves': 4, 'Pants': 5, 'Armor': 6 };
                    sortedArmor.sort((a, b) => {
                        const setA = setOrder[a.armorSet] || 12;
                        const setB = setOrder[b.armorSet] || 12;
                        if (setA !== setB) {
                            return setA - setB;
                        }
                        const typeA = typeOrder[a.category] || 6;
                        const typeB = typeOrder[b.category] || 6;
                        if (typeA !== typeB) {
                            return typeA - typeB;
                        }
                        return b.listedPrice - a.listedPrice;
                    });
                }
                
                csv = 'Item Name,Armor/Qual,Bonus';
                if (includeListedPrice) {
                    csv += ',Listed Price';
                }
                csv += ',Price\n';
                
                sortedArmor.forEach(item => {
                    const armor = item.defense !== 'N/A' ? item.defense : '-';
                    const qual = item.quality !== 'N/A' ? item.quality : '-';
                    const statsText = `${armor} / ${qual}`;
                    const adjustedPrice = Math.floor(item.listedPrice * (1 - discount));
                    
                    csv += `"${item.name}","${statsText}","${item.bonus}"`;
                    if (includeListedPrice) {
                        csv += `,${item.listedPrice}`;
                    }
                    csv += `,${adjustedPrice}\n`;
                });
            }
            
            GM_setClipboard(csv, 'text');
            copyCSVBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyCSVBtn.textContent = 'Copy CSV';
            }, 2000);
        };

        // Settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙️ Icon Settings';
        settingsBtn.style.cssText = `
            padding: 10px 20px;
            background-color: #444;
            color: #d97706;
            border: 1px solid #d97706;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        settingsBtn.onmouseover = () => {
            settingsBtn.style.backgroundColor = '#d97706';
            settingsBtn.style.color = '#ffffff';
        };
        settingsBtn.onmouseout = () => {
            settingsBtn.style.backgroundColor = '#444';
            settingsBtn.style.color = '#d97706';
        };
        settingsBtn.onclick = () => {
            overlay.remove();
            openIconSettings();
        };

        buttonsContainer.appendChild(copyHTMLBtn);
        buttonsContainer.appendChild(copyCSVBtn);
        buttonsContainer.appendChild(settingsBtn);

        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(tabContainer);
        modal.appendChild(optionsContainer);
        modal.appendChild(tableContainer);
        modal.appendChild(buttonsContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }

    // ========== TOOLKIT FUNCTIONS ==========
    
    // Check if on war report page
    function isWarReportPage() {
        return window.location.href.includes('war.php?step=rankreport&rankID=');
    }

    // Get rankID from URL
    function getRankID() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('rankID');
    }

    // Format price in millions
    function formatPriceM(price) {
        return (price / 1000000).toFixed(2) + 'm';
    }

    // Calculate buy price (lowest - discount + margin)
    function calculateBuyPrice(lowestPrice, discount = CACHE_PRICE_DISCOUNT, margin = CACHE_MARGIN_PERCENT) {
        if (!lowestPrice || lowestPrice === 0) return 0;
        const afterDiscount = Math.max(0, lowestPrice - discount);
        const withMargin = afterDiscount * (1 + margin);
        return Math.round(withMargin);
    }

    // Round price to nearest million
    function roundToMillion(price) {
        return Math.round(price / 1000000) * 1000000;
    }

    // Fetch ranked war report from Torn API
    async function fetchWarReport(rankID) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/faction/${rankID}/rankedwarreport`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `ApiKey ${API_KEY}`,
                    'User-Agent': 'TornPDA-UserScript/1.0'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(new Error(data.error.error || data.error));
                            return;
                        }
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Fetch item price from weav3r.dev
    async function fetchItemPrice(itemId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${WEAV3R_API}/${itemId}`,
                headers: {
                    'accept': 'application/json'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(new Error(data.error));
                            return;
                        }
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Get faction leader ID from Torn API (basic endpoint)
    async function getFactionLeader(factionId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/faction/${factionId}/basic`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `ApiKey ${API_KEY}`,
                    'User-Agent': 'TornPDA-UserScript/1.0'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(new Error(data.error.error || data.error));
                            return;
                        }
                        const leader = data.basic?.leader_id || null;
                        resolve(leader);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Open tool picker modal
    function openToolPicker() {
        const existingModal = document.getElementById('rw-tool-picker-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'rw-tool-picker-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 10001;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 8px;
            padding: 30px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 20px;';
        const title = document.createElement('h2');
        title.textContent = '⚔️ Ranked War Toolkit';
        title.style.cssText = 'margin: 0; color: #d97706; font-weight: bold; font-size: 24px; flex: 1;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            line-height: 1;
            flex-shrink: 0;
        `;
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        const toolsContainer = document.createElement('div');
        toolsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';

        // Market Lister tool (always available)
        const marketListerBtn = createToolButton('📊 Market Lister', 'View your ranked war market items', '#d97706', true, null, () => {
            overlay.remove();
            main();
        });
        toolsContainer.appendChild(marketListerBtn);

        // Cache Prices & Buy Quote tool (show always, disable if not on war report page)
        const isWarReport = isWarReportPage();
        const cacheToolBtn = createToolButton(
            '💰 Cache Prices & Buy Quote', 
            isWarReport ? 'View cache prices and calculate buy quotes' : 'Only available on ranked war report page',
            '#10b981', 
            isWarReport,
            isWarReport ? null : 'Only available on ranked war report page',
            () => {
                overlay.remove();
                mainCachePrices();
            }
        );
        toolsContainer.appendChild(cacheToolBtn);

        modal.appendChild(header);
        modal.appendChild(toolsContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }

    // Create a tool button
    function createToolButton(text, description, color, enabled, disabledText, onClick) {
        const button = document.createElement('button');
        button.disabled = !enabled;
        button.style.cssText = `
            padding: 15px 20px;
            background-color: ${enabled ? color : '#555'};
            color: #ffffff;
            border: none;
            border-radius: 6px;
            cursor: ${enabled ? 'pointer' : 'not-allowed'};
            font-size: 16px;
            font-weight: bold;
            text-align: left;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            opacity: ${enabled ? '1' : '0.6'};
        `;
        
        const buttonText = document.createElement('div');
        buttonText.textContent = text;
        buttonText.style.cssText = 'font-size: 18px; margin-bottom: 5px;';
        
        const buttonDesc = document.createElement('div');
        buttonDesc.textContent = description;
        buttonDesc.style.cssText = `font-size: 12px; opacity: ${enabled ? '0.9' : '0.7'}; font-weight: normal; ${disabledText ? 'color: #ff6b6b;' : ''}`;
        
        button.appendChild(buttonText);
        button.appendChild(buttonDesc);
        
        if (enabled) {
            button.onmouseover = () => {
                button.style.transform = 'scale(1.02)';
                button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
            };
            button.onmouseout = () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            };
            button.onclick = onClick;
        }
        
        return button;
    }

    // Main function
    async function main() {
        try {
            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'rw-loading';
            loadingMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #2d2d2d;
                color: #d97706;
                padding: 15px 20px;
                border-radius: 4px;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                border: 1px solid #d97706;
                font-weight: bold;
            `;
            loadingMsg.textContent = 'Loading item market data...';
            document.body.appendChild(loadingMsg);

            // Fetch item market listings (with pagination support)
            let allItems = [];
            let offset = 0;
            let hasMore = true;
            
            while (hasMore) {
                const marketData = await fetchItemMarket(offset);
                const items = processItems(marketData);
                allItems = allItems.concat(items);
                
                // Check if there are more pages using metadata links
                if (marketData._metadata && marketData._metadata.links && marketData._metadata.links.next) {
                    // Parse offset from next link or increment
                    offset += (marketData.itemmarket || []).length;
                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    hasMore = false;
                }
            }
            
            // Separate weapons and armor
            const weapons = allItems.filter(item => item.itemCategory === 'Weapon');
            const armor = allItems.filter(item => item.itemCategory === 'Armor');
            
            // Sort weapons by category first (Primary, Secondary, Melee), then by price
            const weaponCategoryOrder = { 'Primary': 1, 'Secondary': 2, 'Melee': 3, 'Unknown': 4 };
            weapons.sort((a, b) => {
                const catA = weaponCategoryOrder[a.category] || 4;
                const catB = weaponCategoryOrder[b.category] || 4;
                if (catA !== catB) {
                    return catA - catB;
                }
                return b.listedPrice - a.listedPrice;
            });
            
            // Sort armor by category first (Body, Boots, Helmet, Gloves, Pants), then by price
            // This is the default "by type" sorting - will be re-sorted if user selects "by set"
            const armorCategoryOrder = { 'Body': 1, 'Boots': 2, 'Helmet': 3, 'Gloves': 4, 'Pants': 5, 'Armor': 6, 'Unknown': 7 };
            armor.sort((a, b) => {
                const catA = armorCategoryOrder[a.category] || 6;
                const catB = armorCategoryOrder[b.category] || 6;
                if (catA !== catB) {
                    return catA - catB;
                }
                return b.listedPrice - a.listedPrice;
            });
            
            loadingMsg.remove();
            
            if (weapons.length === 0 && armor.length === 0) {
                alert('No ranked war weapons or armor found on the item market.');
                return;
            }
            
            showModal(weapons, armor);
        } catch (error) {
            console.error('Error fetching item market:', error);
            alert('Error loading item market data: ' + error.message);
            const loadingMsg = document.getElementById('rw-loading');
            if (loadingMsg) loadingMsg.remove();
        }
    }

    // ========== CACHE PRICES FUNCTIONS ==========

    // Helper function to fetch cache prices for a faction
    async function fetchFactionCachePrices(faction, loadingMsg) {
        const cacheItems = faction.rewards?.items || [];
        if (cacheItems.length === 0) {
            return [];
        }

        const cacheData = [];
        for (const item of cacheItems) {
            try {
                const priceData = await fetchItemPrice(item.id);
                const listings = priceData.listings || [];
                if (listings.length > 0) {
                    // Sort listings by price (cheapest first)
                    const sortedListings = listings.sort((a, b) => a.price - b.price);
                    cacheData.push({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        cheapestPrice: sortedListings[0].price,
                        listing: sortedListings[0],
                        allListings: sortedListings, // Store all listings
                        selectedListingIndex: 0, // Track which listing is selected (0 = cheapest)
                        marketPrice: priceData.market_price || null,
                        bazaarAverage: priceData.bazaar_average || null
                    });
                } else {
                    cacheData.push({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        cheapestPrice: priceData.market_price || 0,
                        listing: null,
                        allListings: [],
                        selectedListingIndex: 0,
                        marketPrice: priceData.market_price || null,
                        bazaarAverage: priceData.bazaar_average || null
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error fetching price for ${item.name}:`, error);
                cacheData.push({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    cheapestPrice: 0,
                    listing: null,
                    marketPrice: null,
                    bazaarAverage: null,
                    error: error.message
                });
            }
        }
        return cacheData;
    }

    // Main function for cache prices
    async function mainCachePrices() {
        const rankID = getRankID();
        if (!rankID) {
            alert('Could not find rankID in URL');
            return;
        }

        try {
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'rw-cache-loading';
            loadingMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #2d2d2d;
                color: #d97706;
                padding: 15px 20px;
                border-radius: 4px;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                border: 1px solid #d97706;
                font-weight: bold;
            `;
            loadingMsg.textContent = 'Loading war data...';
            document.body.appendChild(loadingMsg);

            const warData = await fetchWarReport(rankID);
            const report = warData.rankedwarreport;
            
            if (!report || !report.factions || report.factions.length < 2) {
                throw new Error('Invalid war report data - need at least 2 factions');
            }

            const winnerFaction = report.factions.find(f => f.id === report.winner);
            const loserFaction = report.factions.find(f => f.id !== report.winner);
            
            if (!winnerFaction || !loserFaction) {
                throw new Error('Could not find both factions');
            }

            // Fetch cache prices for both factions
            loadingMsg.textContent = 'Fetching cache prices for winner...';
            const winnerCacheData = await fetchFactionCachePrices(winnerFaction, loadingMsg);
            
            loadingMsg.textContent = 'Fetching cache prices for loser...';
            const loserCacheData = await fetchFactionCachePrices(loserFaction, loadingMsg);

            loadingMsg.remove();
            showCacheResults(report, winnerFaction, winnerCacheData, loserFaction, loserCacheData);
        } catch (error) {
            console.error('Error fetching war data:', error);
            alert('Error loading war data: ' + error.message);
            const loadingMsg = document.getElementById('rw-cache-loading');
            if (loadingMsg) loadingMsg.remove();
        }
    }

    // Show cache results modal (buy quote only, both factions)
    function showCacheResults(report, winnerFaction, winnerCacheData, loserFaction, loserCacheData) {
        const existingModal = document.getElementById('rw-cache-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'rw-cache-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 20px;';
        const title = document.createElement('h2');
        title.textContent = 'War Cache Buy Quotes';
        title.style.cssText = 'margin: 0; color: #d97706; font-weight: bold; flex: 1;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            line-height: 1;
            flex-shrink: 0;
        `;
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Options container
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = 'margin-bottom: 20px; padding: 15px; background-color: #1a1a1a; border-radius: 4px; border: 1px solid #444;';
        
        // Faction toggle
        const factionRow = document.createElement('div');
        factionRow.style.cssText = 'display: flex; align-items: center; gap: 15px; margin-bottom: 15px;';
        
        const factionLabel = document.createElement('label');
        factionLabel.textContent = 'Faction:';
        factionLabel.style.cssText = 'color: #f5f5f5; font-weight: bold; min-width: 80px;';
        
        const factionSelect = document.createElement('select');
        factionSelect.id = 'faction-select';
        factionSelect.style.cssText = `
            flex: 1;
            padding: 8px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
        `;
        
        const winnerOption = document.createElement('option');
        winnerOption.value = 'winner';
        winnerOption.textContent = `${winnerFaction.name} (Winner)`;
        winnerOption.selected = true;
        
        const loserOption = document.createElement('option');
        loserOption.value = 'loser';
        loserOption.textContent = `${loserFaction.name} (Loser)`;
        
        factionSelect.appendChild(winnerOption);
        factionSelect.appendChild(loserOption);
        
        factionRow.appendChild(factionLabel);
        factionRow.appendChild(factionSelect);
        
        // Discount input (for buy quote)
        const discountRow = document.createElement('div');
        discountRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';
        
        const discountLabel = document.createElement('label');
        discountLabel.textContent = 'Discount (millions):';
        discountLabel.style.cssText = 'color: #f5f5f5; font-weight: bold; min-width: 150px;';
        
        const discountInput = document.createElement('input');
        discountInput.type = 'number';
        discountInput.min = '0';
        discountInput.step = '0.1';
        discountInput.value = CACHE_PRICE_DISCOUNT / 1000000; // Convert to millions
        discountInput.style.cssText = `
            width: 100px;
            padding: 6px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            font-size: 14px;
        `;
        
        const discountUnitLabel = document.createElement('span');
        discountUnitLabel.textContent = 'm';
        discountUnitLabel.style.cssText = 'color: #f5f5f5;';
        
        discountRow.appendChild(discountLabel);
        discountRow.appendChild(discountInput);
        discountRow.appendChild(discountUnitLabel);
        
        // Margin input (for buy quote)
        const marginRow = document.createElement('div');
        marginRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';
        
        const marginLabel = document.createElement('label');
        marginLabel.textContent = 'Margin (%):';
        marginLabel.style.cssText = 'color: #f5f5f5; font-weight: bold; min-width: 150px;';
        
        const marginInput = document.createElement('input');
        marginInput.type = 'number';
        marginInput.min = '0';
        marginInput.max = '100';
        marginInput.step = '0.1';
        marginInput.value = CACHE_MARGIN_PERCENT * 100; // Convert to percentage
        marginInput.style.cssText = `
            width: 100px;
            padding: 6px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            font-size: 14px;
        `;
        
        const marginUnitLabel = document.createElement('span');
        marginUnitLabel.textContent = '%';
        marginUnitLabel.style.cssText = 'color: #f5f5f5;';
        
        marginRow.appendChild(marginLabel);
        marginRow.appendChild(marginInput);
        marginRow.appendChild(marginUnitLabel);
        
        optionsContainer.appendChild(factionRow);
        optionsContainer.appendChild(discountRow);
        optionsContainer.appendChild(marginRow);


        // Table container
        const tableContainer = document.createElement('div');
        
        // Copy button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'margin-top: 20px;';
        
        // Function to update table
        let currentTableHtml = '';
        let cleanTableHtml = ''; // Clean version without tooltips for copying
        const updateTable = async () => {
            const selectedFaction = factionSelect.value;
            const currentFaction = selectedFaction === 'winner' ? winnerFaction : loserFaction;
            const currentCacheData = selectedFaction === 'winner' ? winnerCacheData : loserCacheData;
            
            // Fetch faction basic data for leader/co-leader info
            let leaderId = null;
            let coLeaderId = null;
            try {
                const basicData = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `${API_BASE}/faction/${currentFaction.id}/basic`,
                        headers: {
                            'accept': 'application/json',
                            'Authorization': `ApiKey ${API_KEY}`,
                            'User-Agent': 'TornPDA-UserScript/1.0'
                        },
                        onload: function(response) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (data.error) {
                                    reject(new Error(data.error.error || data.error));
                                    return;
                                }
                                resolve(data);
                            } catch (e) {
                                reject(e);
                            }
                        },
                        onerror: function(error) {
                            reject(error);
                        }
                    });
                });
                
                leaderId = basicData.basic?.leader_id || null;
                coLeaderId = basicData.basic?.co_leader_id || null;
            } catch (e) {
                console.error('Error fetching faction basic data:', e);
            }
            
            const discountM = parseFloat(discountInput.value) || 0;
            const discount = discountM * 1000000;
            const marginPercent = parseFloat(marginInput.value) || 0;
            const margin = marginPercent / 100;
            
            let table = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
            
            // Table header with faction name and leader links
            table += '<thead>';
            table += '<tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
            table += `<th colspan="5" style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold; font-size: 16px;">`;
            table += `${currentFaction.name}`;
            if (leaderId) {
                const leaderMember = currentFaction.members?.find(m => (m.id === leaderId || m.player_id === leaderId));
                const leaderName = leaderMember?.name || 'Leader';
                table += ` | <a href="https://www.torn.com/profiles.php?XID=${leaderId}" target="_blank" style="color: #4dabf7; text-decoration: none;">${leaderName}</a>`;
            }
            if (coLeaderId) {
                const coLeaderMember = currentFaction.members?.find(m => (m.id === coLeaderId || m.player_id === coLeaderId));
                const coLeaderName = coLeaderMember?.name || 'Co-Leader';
                table += ` | <a href="https://www.torn.com/profiles.php?XID=${coLeaderId}" target="_blank" style="color: #4dabf7; text-decoration: none;">${coLeaderName}</a>`;
            }
            table += `</th>`;
            table += '</tr>';
            table += '<tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
            // Column order: Total Buy Price (left), Cache Name, Quantity, Cheapest Listed Price, Buy Price
            table += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Total Buy Price</th>';
            table += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Cache Name</th>';
            table += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Quantity</th>';
            table += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Cheapest Listed Price</th>';
            table += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Buy Price</th>';
            table += '</tr>';
            table += '</thead><tbody>';

            let totalBuyPrice = 0;
            currentCacheData.forEach((cache, index) => {
                const bgColor = index % 2 === 0 ? '#2d2d2d' : '#353535';
                
                // Get the selected listing (or cheapest if no selection)
                const selectedIndex = cache.selectedListingIndex || 0;
                const selectedListing = cache.allListings && cache.allListings.length > 0 
                    ? cache.allListings[selectedIndex] 
                    : cache.listing;
                const currentPrice = selectedListing ? selectedListing.price : cache.cheapestPrice;
                
                // Calculate buy price: (currentPrice - discount) * (1 - margin) - FIX: subtract margin, not add
                const afterDiscount = Math.max(0, currentPrice - discount);
                const buyPrice = Math.round(afterDiscount * (1 - margin)); // Subtract margin
                const buyTotal = buyPrice * cache.quantity;
                totalBuyPrice += buyTotal;
                
                // Calculate percentage difference from bazaar average
                let priceDiffHtml = '';
                let priceDiffColor = '#6ee7b7'; // Default green
                if (cache.bazaarAverage && cache.bazaarAverage > 0) {
                    const percentDiff = ((currentPrice - cache.bazaarAverage) / cache.bazaarAverage) * 100;
                    const percentDiffFormatted = percentDiff >= 0 ? `+${percentDiff.toFixed(1)}%` : `${percentDiff.toFixed(1)}%`;
                    
                    // Simple color coding based on percentage difference
                    if (percentDiff < -5) {
                        priceDiffColor = '#1e40af'; // Dark blue - significantly below average
                    } else if (percentDiff > 5) {
                        priceDiffColor = '#ef4444'; // Red - significantly above average
                    } else {
                        priceDiffColor = '#6ee7b7'; // Green - within normal range
                    }
                    
                    // Build tooltip content with HTML
                    const tooltipId = `tooltip-${cache.id}-${index}`;
                    const marketPriceStr = cache.marketPrice ? `$${formatNumber(cache.marketPrice)} (${formatPriceM(cache.marketPrice)})` : 'N/A';
                    const bazaarAvgStr = `$${formatNumber(cache.bazaarAverage)} (${formatPriceM(cache.bazaarAverage)})`;
                    
                    // Always build alternative listings if available
                    let alternativesHtml = '';
                    if (cache.allListings && cache.allListings.length > 1) {
                        alternativesHtml = '<div style="border-top: 1px solid #444; margin-top: 8px; padding-top: 8px;">';
                        alternativesHtml += '<div style="font-weight: bold; margin-bottom: 4px; color: #d97706;">Alternative Listings:</div>';
                        cache.allListings.slice(0, 5).forEach((listing, listIndex) => {
                            if (listIndex === selectedIndex) return; // Skip current selection
                            const listPrice = listing.price;
                            const listPercentDiff = ((listPrice - cache.bazaarAverage) / cache.bazaarAverage) * 100;
                            
                            // Simple color coding for alternatives
                            let altColor = '#6ee7b7'; // Green
                            if (listPercentDiff < -5) {
                                altColor = '#1e40af'; // Dark blue
                            } else if (listPercentDiff > 5) {
                                altColor = '#ef4444'; // Red
                            }
                            
                            alternativesHtml += `<div class="alt-listing" data-cache-id="${cache.id}" data-cache-index="${index}" data-listing-index="${listIndex}" style="
                                padding: 4px 8px;
                                margin: 2px 0;
                                background-color: #353535;
                                border: 1px solid ${altColor};
                                border-radius: 3px;
                                cursor: pointer;
                                transition: background-color 0.2s;
                            " onmouseover="this.style.backgroundColor='#444'" onmouseout="this.style.backgroundColor='#353535'">
                                $${formatNumber(listPrice)} (${formatPriceM(listPrice)}) <span style="color: ${altColor};">${listPercentDiff >= 0 ? '+' : ''}${listPercentDiff.toFixed(1)}%</span>
                            </div>`;
                        });
                        alternativesHtml += '</div>';
                    }
                    
                    priceDiffHtml = ` <span class="price-diff-tooltip" data-tooltip-id="${tooltipId}" data-cache-id="${cache.id}" data-cache-index="${index}" style="color: ${priceDiffColor}; font-weight: bold; cursor: help; position: relative; border-bottom: 1px dotted ${priceDiffColor}; display: inline-block;">${percentDiffFormatted}
                        <span class="tooltip-content" id="${tooltipId}" style="
                            visibility: hidden;
                            opacity: 0;
                            position: absolute;
                            background-color: #1a1a1a;
                            color: #f5f5f5;
                            padding: 8px 12px;
                            border-radius: 4px;
                            border: 1px solid #444;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                            z-index: 10001;
                            bottom: 100%;
                            left: 50%;
                            transform: translateX(-50%);
                            margin-bottom: 2px;
                            font-size: 12px;
                            font-weight: normal;
                            line-height: 1.6;
                            min-width: 200px;
                            transition: opacity 0.2s;
                            pointer-events: auto;
                        ">
                            <div style="border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 4px;">Market Price: ${marketPriceStr}</div>
                            <div style="border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 4px;">Bazaar Average: ${bazaarAvgStr}</div>
                            ${alternativesHtml}
                        </span>
                    </span>`;
                }
                
                table += `<tr style="background-color: ${bgColor}; color: #f5f5f5;">`;
                // Total Buy Price on left
                table += `<td style="padding: 8px; border: 1px solid #444; text-align: left; color: #fbbf24; font-weight: bold;">$${formatNumber(buyTotal)} (${formatPriceM(buyTotal)})</td>`;
                table += `<td style="padding: 8px; border: 1px solid #444; color: #f5f5f5;">${cache.name}</td>`;
                table += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${cache.quantity}</td>`;
                table += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7;">$${formatNumber(currentPrice)} (${formatPriceM(currentPrice)})${priceDiffHtml}</td>`;
                table += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #fbbf24;">$${formatNumber(buyPrice)} (${formatPriceM(buyPrice)})</td>`;
                table += '</tr>';
            });

            // Total row - rounded total on left
            const roundedTotal = roundToMillion(totalBuyPrice);
            table += '<tr style="background-color: #1a1a1a; border-top: 2px solid #d97706;">';
            table += `<td style="padding: 10px; border: 1px solid #444; text-align: left; color: #fbbf24; font-weight: bold; font-size: 18px;">$${formatNumber(roundedTotal)} (${formatPriceM(roundedTotal)})</td>`;
            table += `<td colspan="4" style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Total Buy Price (Rounded)</td>`;
            table += '</tr>';
            table += '</tbody></table>';

            tableContainer.innerHTML = table;
            currentTableHtml = table;
            
            // Create clean version without tooltips for copying
            let cleanTable = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
            cleanTable += '<thead>';
            cleanTable += '<tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
            cleanTable += `<th colspan="5" style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold; font-size: 16px;">`;
            cleanTable += `${currentFaction.name}`;
            if (leaderId) {
                const leaderMember = currentFaction.members?.find(m => (m.id === leaderId || m.player_id === leaderId));
                const leaderName = leaderMember?.name || 'Leader';
                cleanTable += ` | <a href="https://www.torn.com/profiles.php?XID=${leaderId}" target="_blank" style="color: #4dabf7; text-decoration: none;">${leaderName}</a>`;
            }
            if (coLeaderId) {
                const coLeaderMember = currentFaction.members?.find(m => (m.id === coLeaderId || m.player_id === coLeaderId));
                const coLeaderName = coLeaderMember?.name || 'Co-Leader';
                cleanTable += ` | <a href="https://www.torn.com/profiles.php?XID=${coLeaderId}" target="_blank" style="color: #4dabf7; text-decoration: none;">${coLeaderName}</a>`;
            }
            cleanTable += `</th>`;
            cleanTable += '</tr>';
            cleanTable += '<tr style="background-color: #1a1a1a; border-bottom: 2px solid #d97706;">';
            cleanTable += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Total Buy Price</th>';
            cleanTable += '<th style="padding: 10px; border: 1px solid #444; text-align: left; color: #d97706; font-weight: bold;">Cache Name</th>';
            cleanTable += '<th style="padding: 10px; border: 1px solid #444; text-align: center; color: #d97706; font-weight: bold;">Quantity</th>';
            cleanTable += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Cheapest Listed Price</th>';
            cleanTable += '<th style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Buy Price</th>';
            cleanTable += '</tr>';
            cleanTable += '</thead><tbody>';
            
            let cleanTotalBuyPrice = 0;
            currentCacheData.forEach((cache, index) => {
                const bgColor = index % 2 === 0 ? '#2d2d2d' : '#353535';
                
                // Get the selected listing (or cheapest if no selection)
                const selectedIndex = cache.selectedListingIndex || 0;
                const selectedListing = cache.allListings && cache.allListings.length > 0 
                    ? cache.allListings[selectedIndex] 
                    : cache.listing;
                const currentPrice = selectedListing ? selectedListing.price : cache.cheapestPrice;
                
                // Calculate buy price: (currentPrice - discount) * (1 - margin)
                const afterDiscount = Math.max(0, currentPrice - discount);
                const buyPrice = Math.round(afterDiscount * (1 - margin));
                const buyTotal = buyPrice * cache.quantity;
                cleanTotalBuyPrice += buyTotal;
                
                cleanTable += `<tr style="background-color: ${bgColor}; color: #f5f5f5;">`;
                cleanTable += `<td style="padding: 8px; border: 1px solid #444; text-align: left; color: #fbbf24; font-weight: bold;">$${formatNumber(buyTotal)} (${formatPriceM(buyTotal)})</td>`;
                cleanTable += `<td style="padding: 8px; border: 1px solid #444; color: #f5f5f5;">${cache.name}</td>`;
                cleanTable += `<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #f5f5f5;">${cache.quantity}</td>`;
                cleanTable += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #6ee7b7;">$${formatNumber(currentPrice)} (${formatPriceM(currentPrice)})</td>`;
                cleanTable += `<td style="padding: 8px; border: 1px solid #444; text-align: right; color: #fbbf24;">$${formatNumber(buyPrice)} (${formatPriceM(buyPrice)})</td>`;
                cleanTable += '</tr>';
            });
            
            // Total row - rounded total on left
            const cleanRoundedTotal = roundToMillion(cleanTotalBuyPrice);
            cleanTable += '<tr style="background-color: #1a1a1a; border-top: 2px solid #d97706;">';
            cleanTable += `<td style="padding: 10px; border: 1px solid #444; text-align: left; color: #fbbf24; font-weight: bold; font-size: 18px;">$${formatNumber(cleanRoundedTotal)} (${formatPriceM(cleanRoundedTotal)})</td>`;
            cleanTable += `<td colspan="4" style="padding: 10px; border: 1px solid #444; text-align: right; color: #d97706; font-weight: bold;">Total Buy Price (Rounded)</td>`;
            cleanTable += '</tr>';
            cleanTable += '</tbody></table>';
            
            cleanTableHtml = cleanTable;
            
            // Add tooltip event listeners
            const tooltipSpans = tableContainer.querySelectorAll('.price-diff-tooltip');
            tooltipSpans.forEach(span => {
                const tooltipId = span.getAttribute('data-tooltip-id');
                const tooltip = document.getElementById(tooltipId);
                if (tooltip) {
                    let hideTimeout = null;
                    
                    // Show on hover
                    span.addEventListener('mouseenter', () => {
                        // Clear any pending hide timeout
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        tooltip.style.visibility = 'visible';
                        tooltip.style.opacity = '1';
                    });
                    
                    span.addEventListener('mouseleave', () => {
                        // Delay hiding to allow mouse to move to tooltip
                        hideTimeout = setTimeout(() => {
                            tooltip.style.visibility = 'hidden';
                            tooltip.style.opacity = '0';
                        }, 150); // Small delay to allow mouse movement to tooltip
                    });
                    
                    // Keep tooltip visible when hovering over it
                    tooltip.addEventListener('mouseenter', () => {
                        // Clear any pending hide timeout
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        tooltip.style.visibility = 'visible';
                        tooltip.style.opacity = '1';
                    });
                    
                    tooltip.addEventListener('mouseleave', () => {
                        tooltip.style.visibility = 'hidden';
                        tooltip.style.opacity = '0';
                    });
                    // Also show on click (for mobile/touch)
                    span.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (tooltip.style.visibility === 'visible') {
                            tooltip.style.visibility = 'hidden';
                            tooltip.style.opacity = '0';
                        } else {
                            tooltip.style.visibility = 'visible';
                            tooltip.style.opacity = '1';
                            // Hide on click outside
                            setTimeout(() => {
                                const hideOnClick = (clickEvent) => {
                                    if (!span.contains(clickEvent.target) && !tooltip.contains(clickEvent.target)) {
                                        tooltip.style.visibility = 'hidden';
                                        tooltip.style.opacity = '0';
                                        document.removeEventListener('click', hideOnClick);
                                    }
                                };
                                document.addEventListener('click', hideOnClick);
                            }, 0);
                        }
                    });
                }
            });
            
            // Add event listeners for alternative listing selection
            const altListings = tableContainer.querySelectorAll('.alt-listing');
            altListings.forEach(altListing => {
                altListing.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const cacheId = altListing.getAttribute('data-cache-id');
                    const listingIndex = parseInt(altListing.getAttribute('data-listing-index'));
                    
                    // Find the cache item in the appropriate data array (winner or loser)
                    const selectedFaction = factionSelect.value;
                    const dataArray = selectedFaction === 'winner' ? winnerCacheData : loserCacheData;
                    const cacheItem = dataArray.find(c => c.id == cacheId);
                    
                    if (cacheItem && cacheItem.allListings && cacheItem.allListings[listingIndex]) {
                        cacheItem.selectedListingIndex = listingIndex;
                        cacheItem.cheapestPrice = cacheItem.allListings[listingIndex].price;
                        cacheItem.listing = cacheItem.allListings[listingIndex];
                        // Refresh the table
                        updateTable();
                    }
                });
            });
        };
        
        // Copy HTML button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy HTML table';
        copyBtn.style.cssText = `
            padding: 12px 24px;
            background-color: #444;
            color: #ffffff;
            border: 1px solid #d97706;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            width: 100%;
            transition: all 0.2s;
        `;
        copyBtn.onmouseover = () => { copyBtn.style.backgroundColor = '#d97706'; copyBtn.style.color = '#fff'; };
        copyBtn.onmouseout = () => { copyBtn.style.backgroundColor = '#444'; copyBtn.style.color = '#fff'; };
        copyBtn.onclick = () => {
            GM_setClipboard(cleanTableHtml, 'text');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = '📋 Copy HTML table', 1500);
        };
        buttonContainer.appendChild(copyBtn);
        
        // Initial table render
        updateTable();
        
        // Event listeners
        factionSelect.addEventListener('change', updateTable);
        discountInput.addEventListener('input', updateTable);
        marginInput.addEventListener('input', updateTable);

        modal.appendChild(header);
        modal.appendChild(optionsContainer);
        modal.appendChild(tableContainer);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }


    // Get icon settings from localStorage
    function getIconSettings() {
        return JSON.parse(localStorage.getItem('rwMarketIconSettings')) || {
            position: "end",
            offset: 2
        };
    }

    // Save icon settings to localStorage
    function saveIconSettings(settings) {
        localStorage.setItem('rwMarketIconSettings', JSON.stringify(settings));
    }

    // Add icon to status icons section
    function addIconToStatusIcons() {
        const statusIcons = document.querySelector('ul[class*="status-icons"]');
        if (!statusIcons) return;
        if (document.getElementById('rw-market-icon')) return;

        const iconSettings = getIconSettings();

        const li = document.createElement('li');
        li.className = 'icon-rw-market';
        li.style.background = "none";

        const a = document.createElement('a');
        a.href = "#";
        a.id = "rw-market-icon";
        a.setAttribute('aria-label', 'Ranked War Market Lister');
        a.setAttribute('tabindex', '0');
        a.style.fontSize = "17px";
        a.style.width = "17px";
        a.style.height = "17px";
        a.style.lineHeight = "17px";
        a.style.display = "flex";
        a.style.alignItems = "center";
        a.style.justifyContent = "center";
        a.textContent = "⚔️"; // Sword emoji for ranked war items
        a.title = 'Ranked War Toolkit - Click to open tools';

        // Long press timer
        let longPressTimer = null;
        let isLongPress = false;

        // Click handler - default behavior based on page
        a.addEventListener('click', function (e) {
            e.preventDefault();
            if (!isLongPress) {
                // If on war report page, open cache prices directly; otherwise open market lister
                if (isWarReportPage()) {
                    mainCachePrices();
                } else {
                    main();
                }
            }
            isLongPress = false;
        });

        // Long press for mobile (touchstart/touchend) - opens tool picker
        a.addEventListener('touchstart', function (e) {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                e.preventDefault();
                openToolPicker();
            }, 500); // 500ms for long press
        });

        a.addEventListener('touchend', function (e) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        a.addEventListener('touchmove', function (e) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        // Right-click to open tool picker (desktop)
        a.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            openToolPicker();
        });

        li.appendChild(a);

        // Apply position settings
        if (iconSettings.position === "beginning") {
            statusIcons.insertBefore(li, statusIcons.firstChild);
        } else {
            const children = statusIcons.children;
            const position = Math.max(0, children.length - iconSettings.offset);
            statusIcons.insertBefore(li, children[position] || null);
        }
    }

    // Open icon settings dialog
    function openIconSettings() {
        const existingModal = document.getElementById('rw-icon-settings-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'rw-icon-settings-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            z-index: 10001;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background-color: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        const title = document.createElement('h2');
        title.textContent = 'Icon Position Settings';
        title.style.cssText = 'margin: 0; color: #d97706; font-weight: bold;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            width: 30px;
            height: 30px;
            font-size: 20px;
            cursor: pointer;
            line-height: 1;
        `;
        closeBtn.onclick = () => overlay.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        const iconSettings = getIconSettings();

        // Position selection
        const positionLabel = document.createElement('label');
        positionLabel.textContent = 'Position:';
        positionLabel.style.cssText = 'display: block; color: #f5f5f5; margin-bottom: 8px; font-weight: bold;';
        
        const positionSelect = document.createElement('select');
        positionSelect.style.cssText = `
            width: 100%;
            padding: 8px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            margin-bottom: 15px;
        `;
        const option1 = document.createElement('option');
        option1.value = 'beginning';
        option1.textContent = 'Beginning';
        option1.selected = iconSettings.position === 'beginning';
        const option2 = document.createElement('option');
        option2.value = 'end';
        option2.textContent = 'End (with offset)';
        option2.selected = iconSettings.position === 'end';
        positionSelect.appendChild(option1);
        positionSelect.appendChild(option2);

        // Offset input
        const offsetLabel = document.createElement('label');
        offsetLabel.textContent = 'Offset from end:';
        offsetLabel.style.cssText = 'display: block; color: #f5f5f5; margin-bottom: 8px; font-weight: bold;';
        
        const offsetInput = document.createElement('input');
        offsetInput.type = 'number';
        offsetInput.min = '0';
        offsetInput.value = iconSettings.offset;
        offsetInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background-color: #353535;
            color: #f5f5f5;
            border: 1px solid #444;
            border-radius: 4px;
            margin-bottom: 15px;
        `;

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Settings';
        saveBtn.style.cssText = `
            width: 100%;
            padding: 10px;
            background-color: #d97706;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-top: 10px;
        `;
        saveBtn.onclick = () => {
            const newSettings = {
                position: positionSelect.value,
                offset: parseInt(offsetInput.value) || 2
            };
            saveIconSettings(newSettings);
            overlay.remove();
            // Remove and re-add icon with new position
            const existingIcon = document.getElementById('rw-market-icon');
            if (existingIcon) {
                const li = existingIcon.closest('li');
                if (li) li.remove();
            }
            setTimeout(addIconToStatusIcons, 100);
        };

        modal.appendChild(header);
        modal.appendChild(positionLabel);
        modal.appendChild(positionSelect);
        modal.appendChild(offsetLabel);
        modal.appendChild(offsetInput);
        modal.appendChild(saveBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };
    }

    // Initialize when page loads
    function initialize() {
        // If on compose page, populate recipient and subject from stored data
        // Note: We only set the value, user must manually select from autocomplete dropdown
        if (window.location.href.includes('messages.php') && window.location.hash.includes('p=compose')) {
            const stored = localStorage.getItem('rwToolkitComposeData');
            if (stored) {
                try {
                    const composeData = JSON.parse(stored);
                    // Only use data from last 30 seconds to avoid stale data
                    if (Date.now() - composeData.timestamp < 30000) {
                        const tryFillFields = () => {
                            // Set recipient field value
                            if (composeData.leaderDisplay) {
                                const recipientInput = document.querySelector('input[name="sendto"], input[name="recipient"], input[name="name"]');
                                if (recipientInput && !recipientInput.value) {
                                    recipientInput.value = composeData.leaderDisplay;
                                    // Don't dispatch events - let user manually select from autocomplete
                                }
                            }
                            
                            // Set subject field value
                            if (composeData.subject) {
                                const subjectInput = document.querySelector('input[name="subject"]');
                                if (subjectInput && !subjectInput.value) {
                                    subjectInput.value = composeData.subject;
                                }
                            }
                        };
                        // Try a few times to catch dynamic load
                        tryFillFields();
                        setTimeout(tryFillFields, 500);
                        setTimeout(tryFillFields, 1000);
                        
                        // Clean up after use
                        setTimeout(() => {
                            localStorage.removeItem('rwToolkitComposeData');
                        }, 5000);
                    } else {
                        localStorage.removeItem('rwToolkitComposeData');
                    }
                } catch (e) {
                    console.error('RW Toolkit: error parsing compose data', e);
                    localStorage.removeItem('rwToolkitComposeData');
                }
            }
        }

        const tryAddIcon = () => {
            addIconToStatusIcons();
            if (!document.getElementById('rw-market-icon')) {
                setTimeout(tryAddIcon, 1000);
            }
        };
        tryAddIcon();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Also try after a short delay in case page loads dynamically
    setTimeout(initialize, 1000);
})();

