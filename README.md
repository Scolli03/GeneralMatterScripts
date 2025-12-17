# Ranked War Scripts - Torn PDA Userscripts

This repository contains userscripts for Torn PDA related to ranked war functionality.

## Scripts

### 1. Ranked War Market Lister (`ranked-war-market-lister.user.js`)

A focused script that lists all ranked war weapons and armor from your item market.

**Features:**
- **Automatic Item Detection**: Fetches all ranked war weapons and armor from your item market
- **Complete Statistics**: Displays item name, quality, bonus, listed price, and adjusted price (minus 5%)
- **Weapons & Armor Tabs**: Separate tabs for weapons and armor with different stat columns
- **Armor Sorting**: Sort armor by type (Body, Boots, etc.) or by set (Assault, Riot, etc.)
- **Multiple Export Formats**: Copy tables in BBCode, HTML, or CSV format
- **In-Game Modal**: Beautiful popup modal displays all items in an organized table
- **One-Click Copy**: Easy copy-to-clipboard functionality for forum posts

**Installation:**
1. Open Torn PDA
2. Navigate to Settings → User Scripts
3. Add a new userscript
4. Copy and paste the contents of `ranked-war-market-lister.user.js`
5. Save the script

**Usage:**
1. Once installed, a ⚔️ icon will appear in the status icons section
2. Click the icon to fetch and display your ranked war market items
3. The script will:
   - Fetch all items from your item market (handles pagination automatically)
   - Filter for ranked war weapons and armor
   - Display them in a modal with separate tabs for weapons and armor
4. Use the copy buttons to copy the table in your preferred format:
   - **Copy BBCode Table**: For Torn forum posts (BBCode format)
   - **Copy HTML Table**: For HTML-based posts
   - **Copy CSV**: For spreadsheet applications

### 2. Ranked War Toolkit (`ranked-war-market-toolkit.user.js`)

A comprehensive toolkit that combines market listing with cache price analysis and buy quote generation.

**Features:**
- **All Market Lister Features**: Everything from the Market Lister script
- **Tool Picker Modal**: Choose between different tools from a central menu
- **Cache Prices & Buy Quotes**: 
  - View cache prices from ranked war reports
  - Calculate buy quotes with customizable discount and margin
  - Toggle between price view and buy quote view
  - Mail compose integration with HTML table copying
- **War Report Integration**: Automatically detects when on a ranked war report page

**Installation:**
1. Open Torn PDA
2. Navigate to Settings → User Scripts
3. Add a new userscript
4. Copy and paste the contents of `ranked-war-market-toolkit.user.js`
5. Save the script

**Usage:**
1. Once installed, a ⚔️ icon will appear in the status icons section
2. Click the icon to open the **Ranked War Toolkit** menu
3. Choose from available tools:
   - **📊 Market Lister**: View your ranked war market items (always available)
   - **💰 Cache Prices & Buy Quote**: View cache prices and calculate buy quotes (only available on ranked war report pages)
4. For Cache Prices:
   - Navigate to a ranked war report page (`war.php?step=rankreport&rankID=*`)
   - Open the toolkit and select "Cache Prices & Buy Quote"
   - Toggle between price view and buy quote view
   - Adjust discount (millions) and margin (%) as needed
   - Use "Compose mail and copy HTML body" to copy the message + table and open compose page

## Configuration

Both scripts use the Torn PDA API key variable `###PDA-APIKEY###` which is automatically replaced by Torn PDA when the script runs.

### Item Filtering

The scripts identify ranked war items by:
- Item name patterns (contains "ranked war", "rw ", etc.)
- Item type/category (weapons/armor with quality/bonus modifiers)
- Item IDs (if you populate the ID arrays)

### Customizing Item Lists

If you know specific item IDs for ranked war weapons or armor, you can add them to the arrays at the top of the script:

```javascript
const RANKED_WAR_WEAPONS = [
    // Add weapon item IDs here
];

const RANKED_WAR_ARMOR = [
    // Add armor item IDs here
];
```

## Price Calculation

### Market Lister
The script automatically calculates the adjusted price as:
- **Adjusted Price = Listed Price × (1 - 0.05)**
- This gives you the price minus 5% as requested
- Discount percentage is configurable in the modal

### Toolkit - Buy Quotes
Buy quotes are calculated as:
- **Buy Price = (Cheapest Price - Discount) × (1 + Margin)**
- Default discount: 1 million
- Default margin: 3%
- Both are configurable in the cache prices modal

## API Endpoints Used

### Market Lister
- `GET /v2/user/itemmarket` - Fetches user's item market listings with complete item details (Torn API v2)
- Supports pagination via `offset` parameter

### Toolkit (Additional)
- `GET /v2/faction/{id}/rankedwarreport` - Fetches ranked war report data
- `GET /v2/faction/{id}/basic` - Fetches faction leader information
- `GET https://weav3r.dev/api/marketplace/{item_id}` - Fetches item pricing data

## Troubleshooting

### No items found
- Make sure you have items listed on the item market
- Verify the items are ranked war weapons or armor
- Check that the item names contain "ranked war" or "rw " patterns

### API errors
- Ensure your API key has the necessary permissions
- Check your internet connection
- Verify the API key is valid in Torn PDA settings
- For toolkit cache prices: Make sure you're on a ranked war report page

### Script not loading
- Make sure the script is enabled in Torn PDA
- Check that the script matches the correct URL pattern (`https://www.torn.com/*`)
- Try refreshing the page

### Cache Prices not available
- Make sure you're on a ranked war report page (`war.php?step=rankreport&rankID=*`)
- The "Cache Prices & Buy Quote" tool will be disabled if not on the correct page

## Notes

- Both scripts respect Torn API rate limits with small delays between requests
- Item details are fetched individually to get complete statistics
- Modals can be closed by clicking the X button or clicking outside the modal
- The toolkit's cache prices feature requires being on a ranked war report page
- Mail compose integration copies HTML to clipboard - user must manually paste and select from autocomplete

## Support

For issues or questions, please refer to:
- [Torn PDA Documentation](https://github.com/Manuito83/torn-pda/tree/master/docs)
- [Torn PDA User Scripts](https://github.com/Manuito83/torn-pda/tree/master/userscripts)
- [Torn API Documentation](https://www.torn.com/swagger/index.html)

