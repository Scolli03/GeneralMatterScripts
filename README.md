# Ranked War Market Lister - Torn PDA Userscript

This userscript for Torn PDA automatically retrieves all ranked war weapons and armor listings from your item market and displays them in an organized table format. You can easily copy the formatted table for forum posts.

## Features

- **Automatic Item Detection**: Fetches all ranked war weapons and armor from your item market
- **Complete Statistics**: Displays item name, quality, bonus, listed price, and adjusted price (minus 5%)
- **Multiple Export Formats**: Copy tables in BBCode, HTML, or CSV format
- **In-Game Modal**: Beautiful popup modal displays all items in an organized table
- **One-Click Copy**: Easy copy-to-clipboard functionality for forum posts

## Installation

1. Open Torn PDA
2. Navigate to Settings → User Scripts
3. Add a new userscript
4. Copy and paste the contents of `ranked-war-market-lister.user.js`
5. Save the script

## Usage

1. Once installed, a green "RW Market List" button will appear in the bottom-right corner of Torn pages
2. Click the button to fetch and display your ranked war market items
3. The script will:
   - Fetch all items from your item market
   - Filter for ranked war weapons and armor
   - Display them in a modal with a formatted table
4. Use the copy buttons to copy the table in your preferred format:
   - **Copy BBCode Table**: For Torn forum posts (BBCode format)
   - **Copy HTML Table**: For HTML-based posts
   - **Copy CSV**: For spreadsheet applications

## Configuration

The script uses the Torn PDA API key variable `###PDA-APIKEY###` which is automatically replaced by Torn PDA when the script runs.

### Item Filtering

The script identifies ranked war items by:
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

The script automatically calculates the adjusted price as:
- **Adjusted Price = Listed Price × (1 - 0.05)**
- This gives you the price minus 5% as requested

## API Endpoints Used

- `/user/?selections=items` - Fetches user's items (including market listings)
- `/torn/?selections=items&ids={itemId}` - Fetches detailed item information

## Troubleshooting

### No items found
- Make sure you have items listed on the item market
- Verify the items are ranked war weapons or armor
- Check that the item names contain "ranked war" or "rw " patterns

### API errors
- Ensure your API key has the necessary permissions
- Check your internet connection
- Verify the API key is valid in Torn PDA settings

### Script not loading
- Make sure the script is enabled in Torn PDA
- Check that the script matches the correct URL pattern (`https://www.torn.com/*`)
- Try refreshing the page

## Notes

- The script respects Torn API rate limits with small delays between requests
- Item details are fetched individually to get complete statistics
- The modal can be closed by clicking the X button or clicking outside the modal

## Support

For issues or questions, please refer to:
- [Torn PDA Documentation](https://github.com/Manuito83/torn-pda/tree/master/docs)
- [Torn PDA User Scripts](https://github.com/Manuito83/torn-pda/tree/master/userscripts)
- [Torn API Documentation](https://www.torn.com/swagger/index.html)

