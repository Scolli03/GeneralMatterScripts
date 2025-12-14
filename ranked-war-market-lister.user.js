// ==UserScript==
// @name         Ranked War Market Lister
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Lists all ranked war weapons/armor from item market with stats and prices
// @author       You
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const API_KEY = '###PDA-APIKEY###';
    const API_BASE = 'https://api.torn.com';
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
        const itemId = item.ID || item.id || item.item_id;
        const name = (item.name || '').toLowerCase();
        const type = (item.type || item.category || '').toLowerCase();
        
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
        
        // Check by item type/category and presence of quality/bonus
        // Ranked war items are typically weapons or armor with quality/bonus modifiers
        const hasQuality = item.quality !== undefined || 
                          (item.modifiers && item.modifiers.quality !== undefined);
        const hasBonus = item.bonus !== undefined || 
                        (item.modifiers && item.modifiers.bonus !== undefined);
        
        if (hasQuality || hasBonus) {
            // If it has quality/bonus and is a weapon or armor type, likely ranked war
            if (RANKED_WAR_TYPES.WEAPON.some(t => type.includes(t.toLowerCase())) ||
                RANKED_WAR_TYPES.ARMOR.some(t => type.includes(t.toLowerCase()))) {
                return true;
            }
        }
        
        return false;
    }

    // Fetch user's item market listings
    async function fetchItemMarket() {
        return new Promise((resolve, reject) => {
            // First get user's items to find which ones are on the market
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/user/?selections=items&key=${API_KEY}`,
                headers: {
                    'User-Agent': 'TornPDA-UserScript/1.0'
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

    // Fetch item details from Torn's item database
    async function fetchItemDetails(itemId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/torn/?selections=items&ids=${itemId}&key=${API_KEY}`,
                headers: {
                    'User-Agent': 'TornPDA-UserScript/1.0'
                },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.error) {
                            reject(new Error(data.error));
                            return;
                        }
                        // The response structure may vary, return the item data
                        resolve(data[itemId] || data);
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
    async function processItems(userData) {
        const items = userData.items || {};
        const marketItems = [];
        
        // Process items in batches to avoid too many API calls
        const itemEntries = Object.entries(items);
        
        for (const [itemId, itemData] of itemEntries) {
            // Check if item is on the market (items on market have market_price > 0)
            // In Torn API, items on market typically have a market_price property
            const marketPrice = itemData.market_price || itemData.price || 0;
            if (!marketPrice || marketPrice === 0) {
                continue;
            }
            
            // Fetch item details to get full information
            let itemDetails = {};
            try {
                itemDetails = await fetchItemDetails(itemId);
                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.warn(`Could not fetch details for item ${itemId}:`, e);
            }
            
            // Merge item data with details
            const fullItemData = { ...itemData, ...itemDetails };
            
            // Check if it's a ranked war item
            if (!isRankedWarItem(fullItemData)) {
                continue;
            }
            
            const listedPrice = marketPrice;
            const adjustedPrice = Math.floor(listedPrice * (1 - PRICE_DISCOUNT));
            
            marketItems.push({
                id: itemId,
                name: fullItemData.name || 'Unknown',
                quality: fullItemData.quality !== undefined ? fullItemData.quality : (fullItemData.modifiers?.quality || 'N/A'),
                bonus: fullItemData.bonus !== undefined ? fullItemData.bonus : (fullItemData.modifiers?.bonus || 'N/A'),
                listedPrice: listedPrice,
                adjustedPrice: adjustedPrice,
                // Additional stats
                damage: fullItemData.damage || fullItemData.modifiers?.damage || 'N/A',
                accuracy: fullItemData.accuracy || fullItemData.modifiers?.accuracy || 'N/A',
                defense: fullItemData.defense || fullItemData.modifiers?.defense || 'N/A',
                type: fullItemData.type || fullItemData.category || 'Unknown'
            });
        }
        
        return marketItems.sort((a, b) => b.listedPrice - a.listedPrice);
    }

    // Format number with commas
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Generate forum table format (BBCode)
    function generateForumTable(items) {
        let table = '[table]\n';
        table += '[tr][th]Item Name[/th][th]Quality[/th][th]Bonus[/th][th]Listed Price[/th][th]Price (-5%)[/th][/tr]\n';
        
        items.forEach(item => {
            table += `[tr]`;
            table += `[td]${item.name}[/td]`;
            table += `[td]${item.quality}[/td]`;
            table += `[td]${item.bonus}[/td]`;
            table += `[td]$${formatNumber(item.listedPrice)}[/td]`;
            table += `[td]$${formatNumber(item.adjustedPrice)}[/td]`;
            table += `[/tr]\n`;
        });
        
        table += '[/table]';
        return table;
    }

    // Generate HTML table
    function generateHTMLTable(items) {
        let html = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
        html += '<thead><tr style="background-color: #f0f0f0;">';
        html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Item Name</th>';
        html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Quality</th>';
        html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Bonus</th>';
        html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Listed Price</th>';
        html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Price (-5%)</th>';
        html += '</tr></thead><tbody>';
        
        items.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            html += `<tr style="background-color: ${bgColor};">`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quality}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.bonus}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${formatNumber(item.listedPrice)}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${formatNumber(item.adjustedPrice)}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }

    // Create and show modal
    function showModal(items) {
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
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        `;

        // Modal header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        const title = document.createElement('h2');
        title.textContent = `Ranked War Market Items (${items.length})`;
        title.style.cssText = 'margin: 0; color: #333;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: #f44336;
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

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = generateHTMLTable(items);

        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;';

        // Copy BBCode button
        const copyBBCodeBtn = document.createElement('button');
        copyBBCodeBtn.textContent = 'Copy BBCode Table';
        copyBBCodeBtn.style.cssText = `
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        copyBBCodeBtn.onclick = () => {
            const bbcode = generateForumTable(items);
            GM_setClipboard(bbcode, 'text');
            copyBBCodeBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBBCodeBtn.textContent = 'Copy BBCode Table';
            }, 2000);
        };

        // Copy HTML button
        const copyHTMLBtn = document.createElement('button');
        copyHTMLBtn.textContent = 'Copy HTML Table';
        copyHTMLBtn.style.cssText = `
            padding: 10px 20px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        copyHTMLBtn.onclick = () => {
            const html = generateHTMLTable(items);
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
            background-color: #FF9800;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        copyCSVBtn.onclick = () => {
            let csv = 'Item Name,Quality,Bonus,Listed Price,Price (-5%)\n';
            items.forEach(item => {
                csv += `"${item.name}",${item.quality},${item.bonus},${item.listedPrice},${item.adjustedPrice}\n`;
            });
            GM_setClipboard(csv, 'text');
            copyCSVBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyCSVBtn.textContent = 'Copy CSV';
            }, 2000);
        };

        buttonsContainer.appendChild(copyBBCodeBtn);
        buttonsContainer.appendChild(copyHTMLBtn);
        buttonsContainer.appendChild(copyCSVBtn);

        // Assemble modal
        modal.appendChild(header);
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
                background-color: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 4px;
                z-index: 9999;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            loadingMsg.textContent = 'Loading item market data...';
            document.body.appendChild(loadingMsg);

            const userData = await fetchItemMarket();
            const items = await processItems(userData);
            
            loadingMsg.remove();
            
            if (items.length === 0) {
                alert('No ranked war weapons or armor found on the item market.');
                return;
            }
            
            showModal(items);
        } catch (error) {
            console.error('Error fetching item market:', error);
            alert('Error loading item market data: ' + error.message);
            const loadingMsg = document.getElementById('rw-loading');
            if (loadingMsg) loadingMsg.remove();
        }
    }

    // Add button to page
    function addButton() {
        // Check if button already exists
        if (document.getElementById('rw-market-btn')) {
            return;
        }

        // Try to find a good place to add the button
        // Look for common Torn page elements
        const targetContainer = document.querySelector('.content-wrapper') || 
                                document.querySelector('.page-content') ||
                                document.querySelector('nav') ||
                                document.body;

        const button = document.createElement('button');
        button.id = 'rw-market-btn';
        button.textContent = 'RW Market List';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 9998;
        `;
        button.onclick = main;
        button.title = 'List Ranked War Market Items';

        document.body.appendChild(button);
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        addButton();
    }

    // Also add button after a short delay in case page loads dynamically
    setTimeout(addButton, 1000);
})();

