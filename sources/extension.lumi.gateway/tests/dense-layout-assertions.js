((view, options) => {
  // Pure data assertions shared by the Chromium and real Electron drivers.
  const tolerance = 2;
  const check = (condition, label, actual) => {
    if (!condition) throw new Error('Dense layout ' + label + (actual === undefined ? '' : ': ' + JSON.stringify(actual)));
  };
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const near = (first, second) => finite(first) && finite(second) && Math.abs(first - second) <= tolerance;
  const rectangle = (box, label) => {
    check(box && ['top', 'right', 'bottom', 'left', 'width', 'height'].every(key => finite(box[key])), label + ' has a finite rectangle', box);
    check(box.width > 0 && box.height > 0, label + ' has positive dimensions', box);
  };
  const visible = (entry, label) => {
    check(entry && entry.checkVisibility === true && entry.visibility === 'visible' && entry.display !== 'none' && !entry.hidden && !entry.hiddenAncestor,
      label + ' is visible', entry && { checkVisibility: entry.checkVisibility, visibility: entry.visibility, display: entry.display, hidden: entry.hidden, hiddenAncestor: entry.hiddenAncestor });
    rectangle(entry.rect, label);
  };
  const contained = (inner, outer, label) => {
    check(inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance && inner.top >= outer.top - tolerance && inner.bottom <= outer.bottom + tolerance,
      label + ' stays inside its row', { inner, outer });
  };
  const pageBounds = (box, label) => {
    check(box.left >= view.pageRect.left - tolerance && box.right <= view.pageRect.right + tolerance,
      label + ' stays inside page width', { left: box.left, right: box.right, pageLeft: view.pageRect.left, pageRight: view.pageRect.right });
  };
  check(view && options, 'receives a view and options');
  check(finite(view.width) && view.width > 0 && finite(view.content), 'has finite viewport and content widths', { width: view.width, content: view.content });
  check(view.content <= view.width + tolerance, 'page has no horizontal overflow', { width: view.width, content: view.content });
  rectangle(view.pageRect, 'page');
  const wide = view.width > 900;
  for (const [kind, expectedCount, selectedId] of [
    ['routes', options.expectedRoutes, options.selectedRoute],
    ['rules', options.expectedRules, options.selectedRule],
  ]) {
    check(Number.isInteger(expectedCount) && expectedCount > 0 && nonempty(selectedId), kind + ' has explicit expected rows and selection', { expectedCount, selectedId });
    const table = view[kind];
    check(table, kind + ' table exists');
    visible(table, kind + ' table');
    pageBounds(table.rect, kind + ' table');
    check(table.tagName === 'table' && table.bodyTagName === 'tbody', kind + ' uses native table and tbody', { tag: table.tagName, body: table.bodyTagName });
    check(table.display === (wide ? 'table' : 'block'), kind + ' table display matches viewport', { width: view.width, display: table.display });
    check(table.headerCount === 6 && table.headers?.length === 6 && table.thScopes?.length === 6 && table.thScopes.every(scope => scope === 'col'), kind + ' has six column headers', { count: table.headerCount, scopes: table.thScopes });
    check(nonempty(table.theadText), kind + ' header text is present');
    for (const [index, header] of table.headers.entries()) {
      check(nonempty(header.text) && header.scope === 'col', kind + ' header ' + (index + 1) + ' has text and column scope', { text: header.text, scope: header.scope });
      if (wide) visible(header, kind + ' header ' + (index + 1));
    }
    check(Array.isArray(table.rows) && table.rowCount === expectedCount && table.rows.length === expectedCount, kind + ' has expected row count', { expected: expectedCount, rowCount: table.rowCount, rows: table.rows?.length });
    check(table.rowIdsUnique === true && new Set(table.rows.map(row => row.id)).size === expectedCount, kind + ' row IDs are unique');
    check(table.selectionIdsUnique === true && table.selectionButtonCount === expectedCount, kind + ' selection buttons are unique', { count: table.selectionButtonCount, unique: table.selectionIdsUnique });
    check(Array.isArray(table.selectedIds) && table.selectedIds.length === 1 && table.selectedIds[0] === selectedId, kind + ' has exactly the expected selection', { expected: selectedId, actual: table.selectedIds });
    const wrapper = table.scrollWrapper;
    check(wrapper, kind + ' has a vertical scroll wrapper');
    visible(wrapper, kind + ' scroll wrapper');
    pageBounds(wrapper.rect, kind + ' scroll wrapper');
    check(['auto', 'scroll'].includes(wrapper.overflowY), kind + ' wrapper permits vertical scrolling', wrapper.overflowY);
    check(finite(wrapper.maxHeightPx) && wrapper.maxHeightPx > 0 && finite(wrapper.clientHeight) && wrapper.clientHeight > 0 && wrapper.clientHeight <= wrapper.maxHeightPx + tolerance,
      kind + ' wrapper height is bounded', { maxHeight: wrapper.maxHeightPx, clientHeight: wrapper.clientHeight });
    check(finite(wrapper.clientWidth) && wrapper.clientWidth > 0 && finite(wrapper.scrollWidth) && wrapper.scrollWidth <= wrapper.clientWidth + tolerance,
      kind + ' wrapper has no horizontal overflow', { clientWidth: wrapper.clientWidth, scrollWidth: wrapper.scrollWidth });
    check(wrapper.scrollLeft === 0, kind + ' wrapper is not horizontally scrolled', wrapper.scrollLeft);
    check(near(table.rect.left, wrapper.rect.left) && near(table.rect.width, wrapper.clientWidth) && table.rect.right <= wrapper.rect.right + tolerance,
      kind + ' table fills its wrapper content width', { table: table.rect, wrapper: wrapper.rect, clientWidth: wrapper.clientWidth });
    check(finite(wrapper.scrollHeight) && wrapper.scrollHeight >= wrapper.clientHeight - tolerance, kind + ' wrapper has a valid scroll height', { scrollHeight: wrapper.scrollHeight, clientHeight: wrapper.clientHeight });
    if (kind === 'rules') check(wrapper.scrollHeight > wrapper.clientHeight, 'rules list has vertically scrollable content', { scrollHeight: wrapper.scrollHeight, clientHeight: wrapper.clientHeight });
    for (const row of table.rows) {
      const label = kind + ' row ' + row.id;
      check(nonempty(row.id), kind + ' row has an ID');
      visible(row, label);
      pageBounds(row.rect, label);
      check(row.display === (wide ? 'table-row' : 'grid'), label + ' display matches viewport', row.display);
      check(row.cellCount === 6 && Array.isArray(row.cells) && row.cells.length === 6, label + ' has six cells', { count: row.cellCount, cells: row.cells?.length });
      check(row.selectionButtonCount === 1 && row.editButtonCount === 1 && row.globalSelectionButtonCount === 1 && row.globalEditButtonCount === 1 && row.selectButtons?.length === 1 && row.editButtons?.length === 1,
        label + ' has one unique selection and edit button', { select: row.selectionButtonCount, edit: row.editButtonCount, globalSelect: row.globalSelectionButtonCount, globalEdit: row.globalEditButtonCount });
      const select = row.selectButtons[0], edit = row.editButtons[0];
      visible(select, label + ' selection button');
      visible(edit, label + ' edit button');
      check(select.value === row.id && edit.value === row.id, label + ' buttons identify their row', { select: select.value, edit: edit.value });
      check(select.ariaPressed === 'true' || select.ariaPressed === 'false', label + ' selection has boolean aria-pressed', select.ariaPressed);
      check(select.ariaPressed === String(row.id === selectedId) && row.selected === (row.id === selectedId), label + ' selection state matches expected ID', { selectedId, ariaPressed: select.ariaPressed, selected: row.selected });
      for (const [index, cell] of row.cells.entries()) {
        const cellLabel = label + ' cell ' + (index + 1);
        check(cell.tagName === 'td' && nonempty(cell.label) && nonempty(cell.text) && nonempty(cell.visibleText), cellLabel + ' retains its label and text', { tag: cell.tagName, label: cell.label, text: cell.text, visibleText: cell.visibleText });
        visible(cell, cellLabel);
        check(cell.display === (wide ? 'table-cell' : 'flex'), cellLabel + ' display matches viewport', cell.display);
        contained(cell.rect, row.rect, cellLabel);
        check(finite(cell.clientWidth) && cell.clientWidth > 0 && finite(cell.scrollWidth) && cell.scrollWidth <= cell.clientWidth + tolerance,
          cellLabel + ' text has no horizontal overflow', { clientWidth: cell.clientWidth, scrollWidth: cell.scrollWidth });
        if (wide && index > 0) {
          const previous = row.cells[index - 1].rect;
          check(cell.rect.left >= previous.right - tolerance && cell.rect.left > previous.left && near(cell.rect.top, previous.top),
            cellLabel + ' follows the previous column horizontally', { previous, current: cell.rect });
        }
      }
    }
  }
  for (const edge of ['left', 'right']) {
    check(near(view.routes.scrollWrapper.rect[edge], view.rules.scrollWrapper.rect[edge]), 'route and rule wrappers align on the ' + edge, { routes: view.routes.scrollWrapper.rect[edge], rules: view.rules.scrollWrapper.rect[edge] });
    check(near(view.routes.rect[edge], view.rules.rect[edge]), 'route and rule tables align on the ' + edge, { routes: view.routes.rect[edge], rules: view.rules.rect[edge] });
  }
  for (const id of ['route-models-details', 'route-settings-details', 'rule-settings-details', 'preview-details']) {
    const detail = view.details?.[id];
    check(detail && detail.tagName === 'details' && detail.open === false && detail.content && detail.content.checkVisibility === false,
      id + ' is closed with its actual content hidden', detail && { tag: detail.tagName, open: detail.open, contentVisibility: detail.content?.checkVisibility });
    visible(detail, id + ' disclosure');
  }
  if (wide) {
    check(finite(options.hostHeight) && options.hostHeight > 40, 'has an explicit host height', options.hostHeight);
    check(near(view.ruleTableTop, view.rules.rect.top) && view.ruleTableTop >= 0 && view.ruleTableTop < options.hostHeight - 40,
      'rules table appears on the first screen', { top: view.ruleTableTop, hostHeight: options.hostHeight });
    check(view.rules.rows[0].rect.top < options.hostHeight - 20, 'first rule row appears on the first screen', { top: view.rules.rows[0].rect.top, hostHeight: options.hostHeight });
  }
  return view;
})
