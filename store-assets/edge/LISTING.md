# Microsoft Edge Add-ons Listing Notes

## Product

- Name: `Tab Group Automata`
- Category: `Productivity`

## Short Description

Automatically group tabs with regex rules, domain-based grouping, and smart expand/collapse behavior.

## Longer Description

Tab Group Automata helps keep large tab sets organized automatically.

Features:

- Create grouping rules with URL match patterns and regular expressions
- Group tabs by domain or custom rules
- Merge matching tabs into existing groups across windows
- Strict mode to remove tabs from groups when URLs no longer match
- Automatically collapse inactive groups
- Automatically expand groups when tabs are added
- Import and export grouping rules

## Permissions Explanation

- `tabs`: required to read tab URLs/titles and place matching tabs into groups
- `tabGroups`: required to create, update, collapse, expand, and manage tab groups
- `storage`: required to save your grouping rules and extension settings

## Privacy

This extension processes tab and tab-group information locally in the browser to provide grouping features. It stores user configuration in browser extension storage and does not intentionally transmit tab data to external servers for analytics, advertising, or profiling.

Suggested public privacy policy URL after pushing the repo:

- `https://github.com/ZhangTianrong/auto-group-tabs/blob/main/PRIVACY.md`

## Attribution

Include this in the store description if required by the Flaticon license:

```html
<a href="https://www.flaticon.com/free-icons/automation" title="automation icons">Automation icons created by Freepik - Flaticon</a>
```

## Assets

- Package: `tab-group-automata.zip`
- Store logo: `store-assets/edge/extension-logo-300.png`
- Small promotional tile: `store-assets/edge/small-promotional-tile-440x280.png`
