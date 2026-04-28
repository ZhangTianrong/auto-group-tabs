# Microsoft Edge Add-ons Listing Notes

## Product

- Name: `TabGroup Automata`
- Category: `Productivity`

## Short Description

### English

Automatically group tabs with regex rules, domain-based grouping, and smart expand/collapse behavior.

### German

Automatisches Gruppieren von Tabs mit Regex-Regeln, Domain-Gruppierung und intelligenter Ein-/Ausklapp-Logik.

### Simplified Chinese

使用正则规则、按域名分组以及智能展开/折叠行为自动整理标签页。

## Longer Description

### English

TabGroup Automata helps keep large tab collections organized automatically, so you can spend less time cleaning up browser windows and more time working. It lets you define grouping behavior with URL match patterns, regular expressions, and domain-based rules, then keeps matching tabs assigned to the right groups while you browse. You can merge tabs into existing groups across windows, remove tabs when they no longer match, automatically collapse inactive groups, expand groups when tabs are added, and import or export your saved rule set.

Features:

- Create grouping rules with URL match patterns and regular expressions
- Group tabs by domain or custom rules
- Merge matching tabs into existing groups across windows
- Strict mode to remove tabs from groups when URLs no longer match
- Automatically collapse inactive groups
- Automatically expand groups when tabs are added
- Import and export grouping rules

### German

TabGroup Automata hilft dabei, große Mengen offener Tabs automatisch und zuverlässig organisiert zu halten. Die Erweiterung erlaubt es, Gruppierungsregeln mit URL-Mustern, regulären Ausdrücken und Domain-basierten Regeln zu definieren und passende Tabs dann automatisch den richtigen Gruppen zuzuweisen. Außerdem können passende Tabs in bereits vorhandene Gruppen über mehrere Fenster hinweg zusammengeführt, nicht mehr passende Tabs wieder entfernt, inaktive Gruppen automatisch eingeklappt, neu aktualisierte Gruppen automatisch ausgeklappt sowie Regel-Sammlungen importiert und exportiert werden.

Funktionen:

- Erstellen von Gruppierungsregeln mit URL-Mustern und regulären Ausdrücken
- Gruppieren von Tabs nach Domain oder benutzerdefinierten Regeln
- Zusammenführen passender Tabs in bereits vorhandene Gruppen über mehrere Fenster hinweg
- Strikter Modus zum Entfernen von Tabs aus Gruppen, wenn die URL nicht mehr passt
- Automatisches Einklappen inaktiver Gruppen
- Automatisches Ausklappen von Gruppen, wenn neue Tabs hinzugefügt werden
- Import und Export von Gruppierungsregeln

### Simplified Chinese

TabGroup Automata 可以帮助你自动整理大量标签页，减少手动拖动、分组和清理窗口的时间。你可以使用 URL 匹配规则、正则表达式以及基于域名的规则来定义标签页应该进入哪个分组，扩展会在你浏览网页时自动将符合条件的标签页放入对应分组。它还支持跨窗口合并到已有分组、在 URL 不再匹配时自动移出分组、自动折叠非活动分组、在有新标签页加入时自动展开分组，以及导入和导出整套分组规则，方便在不同设备或配置之间迁移。

功能特性：

- 使用 URL 匹配规则和正则表达式创建分组规则
- 按域名或自定义规则对标签页进行分组
- 将匹配的标签页合并到其他窗口中已存在的分组
- 严格模式下，当 URL 不再匹配时将标签页移出分组
- 自动折叠非活动分组
- 当标签页加入分组时自动展开分组
- 支持导入和导出分组规则

## Permissions Explanation

- `tabs`: required to read tab URLs/titles and place matching tabs into groups
- `tabGroups`: required to create, update, collapse, expand, and manage tab groups
- `storage`: required to save your grouping rules and extension settings

## Privacy

This extension processes tab and tab-group information locally in the browser to provide grouping features. It stores user configuration in browser extension storage and does not intentionally transmit tab data to external servers for analytics, advertising, or profiling.

Suggested public privacy policy URL after pushing the repo:

- `https://github.com/ZhangTianrong/auto-group-tabs/blob/auto-domain-group/PRIVACY.md`

## Attribution

Include this in the store description if required by the Flaticon license:

```html
<a href="https://www.flaticon.com/free-icons/automation" title="automation icons">Automation icons created by Freepik - Flaticon</a>
```

## Assets

- Package: `tabgroup-automata.zip`
- Store logo: `store-assets/edge/extension-logo-300.png`
- Small promotional tile: `store-assets/edge/small-promotional-tile-440x280.png`
