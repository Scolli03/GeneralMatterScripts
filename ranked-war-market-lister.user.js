// ==UserScript==
// @name         Ranked War Market Lister
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Lists all current user's ranked war weapons/armor from item market with stats and prices
// @author       Scolli03[3150751]
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const API_KEY = '###PDA-APIKEY###';
    const API_BASE = 'https://api.torn.com/v2';
    const PRICE_DISCOUNT = 0.05; // 5% discount

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
                // For armor, use the item name to determine category (Body, Boots, Helmet, Gloves, etc.)
                const itemName = (item.name || '').toLowerCase();
                if (itemName.includes('body') || itemName.includes('vest') || itemName.includes('chest')) {
                    category = 'Body';
                } else if (itemName.includes('boot') || itemName.includes('shoe')) {
                    category = 'Boots';
                } else if (itemName.includes('helmet') || itemName.includes('hat') || itemName.includes('cap')) {
                    category = 'Helmet';
                } else if (itemName.includes('glove') || itemName.includes('hand')) {
                    category = 'Gloves';
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
    function generateArmorHTMLTable(items, includeListedPrice = false) {
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
            updateTable();
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
            updateTable();
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
        
        optionsContainer.appendChild(discountRow);
        optionsContainer.appendChild(checkboxRow);

        // Table container
        const tableContainer = document.createElement('div');
        const updateTable = () => {
            const discountPercent = parseFloat(discountInput.value) || 0;
            const discount = discountPercent / 100;
            const includeListedPrice = includeListedPriceCheckbox.checked;
            
            if (activeTab === 'weapons') {
                // Recalculate adjusted prices with new discount
                const itemsWithDiscount = weapons.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                tableContainer.innerHTML = generateWeaponHTMLTable(itemsWithDiscount, includeListedPrice);
            } else {
                // Recalculate adjusted prices with new discount
                const itemsWithDiscount = armor.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                tableContainer.innerHTML = generateArmorHTMLTable(itemsWithDiscount, includeListedPrice);
            }
        };
        updateTable();
        includeListedPriceCheckbox.addEventListener('change', updateTable);
        discountInput.addEventListener('input', updateTable);

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
                const itemsWithDiscount = armor.map(item => ({
                    ...item,
                    adjustedPrice: Math.floor(item.listedPrice * (1 - discount))
                }));
                html = generateArmorHTMLTable(itemsWithDiscount, includeListedPrice);
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
            
            const currentItems = activeTab === 'weapons' ? weapons : armor;
            
            let csv;
            if (activeTab === 'weapons') {
                csv = 'Item Name,Dmg/Acc/Qual,Bonus';
                if (includeListedPrice) {
                    csv += ',Listed Price';
                }
                csv += ',Price\n';
                
                currentItems.forEach(item => {
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
                csv = 'Item Name,Armor/Qual,Bonus';
                if (includeListedPrice) {
                    csv += ',Listed Price';
                }
                csv += ',Price\n';
                
                currentItems.forEach(item => {
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
            
            // Sort armor by category first (Body, Boots, Helmet, Gloves), then by price
            const armorCategoryOrder = { 'Body': 1, 'Boots': 2, 'Helmet': 3, 'Gloves': 4, 'Armor': 5, 'Unknown': 6 };
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
        a.title = 'Ranked War Market Lister - Click to view your RW market items';

        // Long press timer
        let longPressTimer = null;
        let isLongPress = false;

        // Click handler
        a.addEventListener('click', function (e) {
            e.preventDefault();
            if (!isLongPress) {
                main();
            }
            isLongPress = false;
        });

        // Long press for mobile (touchstart/touchend)
        a.addEventListener('touchstart', function (e) {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                e.preventDefault();
                openIconSettings();
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

        // Right-click to open settings (desktop)
        a.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            openIconSettings();
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

