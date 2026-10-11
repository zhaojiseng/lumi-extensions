(() => {
  // This function expression is read by both UI drivers and evaluated in the plugin document.
  const text = element => element?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const rect = element => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      x: box.x, y: box.y, top: box.top, right: box.right,
      bottom: box.bottom, left: box.left, width: box.width, height: box.height,
    };
  };
  const visibility = element => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      display: style.display,
      visibility: style.visibility,
      checkVisibility: typeof element.checkVisibility === 'function'
        ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : null,
      hidden: element.hidden,
      hiddenAncestor: Boolean(element.closest('[hidden]')),
    };
  };
  const elementEvidence = element => element ? {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    rect: rect(element),
    ...visibility(element),
  } : null;
  const buttonEvidence = (button, attribute) => ({
    ...elementEvidence(button),
    value: button.getAttribute(attribute),
    text: text(button),
    ariaLabel: button.getAttribute('aria-label'),
    ariaPressed: button.getAttribute('aria-pressed'),
    disabled: button.disabled,
  });
  const scrollWrapper = table => {
    for (let parent = table?.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!['auto', 'scroll'].includes(style.overflowY)) continue;
      return {
        ...elementEvidence(parent),
        className: parent.className,
        clientWidth: parent.clientWidth,
        scrollWidth: parent.scrollWidth,
        clientHeight: parent.clientHeight,
        scrollHeight: parent.scrollHeight,
        scrollTop: parent.scrollTop,
        scrollLeft: parent.scrollLeft,
        maxHeight: style.maxHeight,
        maxHeightPx: Number.isFinite(parseFloat(style.maxHeight)) ? parseFloat(style.maxHeight) : null,
        overflowY: style.overflowY,
        overflowX: style.overflowX,
      };
    }
    return null;
  };
  const tableEvidence = (bodyId, kind) => {
    const body = document.getElementById(bodyId);
    const table = body?.closest('table');
    if (!table) return null;
    const idAttribute = 'data-' + kind + '-id';
    const editAttribute = 'data-' + kind + '-edit';
    const selectionButtons = [...table.querySelectorAll('button[' + idAttribute + ']')];
    const headers = [...table.querySelectorAll('th')].map(header => ({
      text: text(header), scope: header.getAttribute('scope'),
      rect: rect(header), ...visibility(header),
    }));
    const rows = [...body.querySelectorAll('tr[' + idAttribute + ']')].map(row => {
      const id = row.getAttribute(idAttribute);
      const selectButtons = [...row.querySelectorAll('button[' + idAttribute + ']')];
      const editButtons = [...row.querySelectorAll('button[' + editAttribute + ']')];
      const cells = [...row.cells].map(cell => ({
        tagName: cell.tagName.toLowerCase(),
        label: cell.getAttribute('data-label'),
        text: text(cell),
        visibleText: cell.innerText.replace(/\s+/g, ' ').trim(),
        colSpan: cell.colSpan,
        rowSpan: cell.rowSpan,
        rect: rect(cell),
        clientWidth: cell.clientWidth,
        scrollWidth: cell.scrollWidth,
        ...visibility(cell),
      }));
      return {
        id, rect: rect(row), ...visibility(row),
        cellCount: cells.length,
        cells,
        selectionButtonCount: selectButtons.length,
        editButtonCount: editButtons.length,
        globalSelectionButtonCount: [...document.querySelectorAll('button[' + idAttribute + ']')]
          .filter(button => button.getAttribute(idAttribute) === id).length,
        globalEditButtonCount: [...document.querySelectorAll('button[' + editAttribute + ']')]
          .filter(button => button.getAttribute(editAttribute) === id).length,
        selectButtons: selectButtons.map(button => buttonEvidence(button, idAttribute)),
        editButtons: editButtons.map(button => buttonEvidence(button, editAttribute)),
        selected: selectButtons.some(button => button.getAttribute('aria-pressed') === 'true'),
      };
    });
    const selectionIds = selectionButtons.map(button => button.getAttribute(idAttribute));
    return {
      ...elementEvidence(table),
      bodyId,
      bodyTagName: body.tagName.toLowerCase(),
      headerCount: table.tHead?.querySelectorAll('th').length ?? 0,
      theadText: text(table.tHead),
      thead: elementEvidence(table.tHead),
      thScopes: headers.map(header => header.scope),
      headers,
      rowCount: rows.length,
      rowIdsUnique: new Set(rows.map(row => row.id)).size === rows.length,
      selectionButtonCount: selectionButtons.length,
      selectionIdsUnique: new Set(selectionIds).size === selectionIds.length,
      selectedIds: rows.filter(row => row.selected).map(row => row.id),
      rows,
      scrollWrapper: scrollWrapper(table),
    };
  };
  const details = Object.fromEntries([
    'route-models-details', 'route-settings-details', 'rule-settings-details', 'preview-details',
  ].map(id => {
    const element = document.getElementById(id);
    // Inspect real content, rather than the summary which remains visible when closed.
    const content = element?.querySelector('form, section');
    return [id, element ? {
      ...elementEvidence(element),
      open: element.open,
      content: elementEvidence(content),
    } : null];
  }));
  const routes = tableEvidence('routes-list', 'route');
  const rules = tableEvidence('rules-list', 'rule');
  const workspace = document.getElementById('route-workspace');
  return {
    width: innerWidth,
    viewportHeight: innerHeight,
    content: document.documentElement.scrollWidth,
    contentClientWidth: document.documentElement.clientWidth,
    pageRect: rect(document.querySelector('main.gateway-page')),
    scrollX,
    scrollY,
    routes,
    rules,
    details,
    routeWorkspace: workspace ? {
      ...elementEvidence(workspace),
      title: text(document.getElementById('route-overview-title')),
      clientUrl: text(document.getElementById('route-client-url')),
    } : null,
    routeRowHeights: routes?.rows.map(row => row.rect.height) ?? [],
    ruleRowHeights: rules?.rows.map(row => row.rect.height) ?? [],
    ruleTableTop: rules?.rect.top ?? null,
  };
})
