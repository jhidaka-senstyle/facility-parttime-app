/**
 * 事務用一覧シート同期
 */
var OfficeListService = (function () {
  var SHEET_NAME = '事務用一覧';
  var MANAGED_COLS = 8;
  var POST_APPROVAL_CANCEL_LABEL = '承認後キャンセル';
  var DATA_START_ROW = 2;

  function getSheet() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('シート「' + SHEET_NAME + '」が見つかりません。');
    }
    return sheet;
  }

  function buildSlotMap() {
    var map = {};
    SheetRepository.getAllSlots().forEach(function (slot) {
      map[slot.slotId] = slot;
    });
    return map;
  }

  function getConfirmedShiftLabel(app, slotMap) {
    var slot = slotMap[app.slotId] || null;
    if (slot) {
      var slotCode = Config.resolveShiftCode(slot.shiftType);
      if (slotCode === 'FULLDAY' || slotCode === 'AM' || slotCode === 'PM') {
        return Config.getShiftTypeLabel(slotCode);
      }
    }
    return Config.getShiftTypeLabel(Config.getEffectivePreferredShiftCode(app));
  }

  function isOfficeListTarget(app) {
    return app.status === Config.APP_STATUS.APPROVED ||
      app.status === Config.APP_STATUS.CANCELLED;
  }

  function getPostApprovalCancelLabel(app) {
    if (app.status === Config.APP_STATUS.CANCELLED) {
      return POST_APPROVAL_CANCEL_LABEL;
    }
    return '';
  }

  function buildManagedCells(app, slotMap) {
    return [
      app.applicationId,
      app.workDate,
      app.workFacility,
      app.homeFacility,
      app.name,
      Config.getJobTypeLabel(app.jobType),
      getConfirmedShiftLabel(app, slotMap),
      getPostApprovalCancelLabel(app)
    ];
  }

  function compareEntries(a, b) {
    var dateA = Utils.toDateKey(a.workDate);
    var dateB = Utils.toDateKey(b.workDate);
    if (dateA !== dateB) {
      return dateA < dateB ? -1 : 1;
    }
    var facilityCmp = String(a.workFacility).localeCompare(String(b.workFacility), 'ja');
    if (facilityCmp !== 0) {
      return facilityCmp;
    }
    return String(a.name).localeCompare(String(b.name), 'ja');
  }

  function padRow(row, length) {
    var padded = row.slice();
    while (padded.length < length) {
      padded.push('');
    }
    return padded;
  }

  function readExistingRows(sheet, lastCol) {
    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      return [];
    }

    var numRows = lastRow - DATA_START_ROW + 1;
    var values = sheet.getRange(DATA_START_ROW, 1, numRows, lastCol).getValues();
    return values.map(function (row, index) {
      return {
        rowIndex: DATA_START_ROW + index,
        applicationId: String(row[0] || '').trim(),
        fullRow: padRow(row, lastCol)
      };
    });
  }

  function mergeManagedCells(fullRow, managedCells, lastCol) {
    var merged = padRow(fullRow, lastCol);
    for (var i = 0; i < MANAGED_COLS; i++) {
      merged[i] = managedCells[i];
    }
    return merged;
  }

  function refreshOfficeList() {
    var sheet = getSheet();
    var lastCol = Math.max(sheet.getLastColumn(), MANAGED_COLS);
    var slotMap = buildSlotMap();

    var targetApps = SheetRepository.getAllApplications().filter(isOfficeListTarget);

    var existingRows = readExistingRows(sheet, lastCol);
    var existingById = {};
    existingRows.forEach(function (row) {
      if (row.applicationId) {
        existingById[row.applicationId] = row;
      }
    });

    var orphanRows = existingRows
      .filter(function (row) {
        return !row.applicationId;
      })
      .map(function (row) {
        return padRow(row.fullRow, lastCol);
      });

    var outputEntries = targetApps.map(function (app) {
      var managedCells = buildManagedCells(app, slotMap);
      var existing = existingById[app.applicationId];
      var fullRow = existing
        ? mergeManagedCells(existing.fullRow, managedCells, lastCol)
        : mergeManagedCells([], managedCells, lastCol);

      return {
        applicationId: app.applicationId,
        workDate: app.workDate,
        workFacility: app.workFacility,
        name: app.name,
        fullRow: fullRow
      };
    });

    outputEntries.sort(compareEntries);

    var outputRows = outputEntries.map(function (entry) {
      return entry.fullRow;
    }).concat(orphanRows);

    var currentDataRowCount = sheet.getLastRow() >= DATA_START_ROW
      ? sheet.getLastRow() - DATA_START_ROW + 1
      : 0;
    var targetDataRowCount = outputRows.length;

    if (targetDataRowCount > 0) {
      sheet.getRange(DATA_START_ROW, 1, targetDataRowCount, lastCol).setValues(outputRows);
    }

    if (currentDataRowCount > targetDataRowCount) {
      sheet.deleteRows(
        DATA_START_ROW + targetDataRowCount,
        currentDataRowCount - targetDataRowCount
      );
    }
  }

  function refreshOfficeListSafe() {
    try {
      refreshOfficeList();
    } catch (e) {
      Logger.log('事務用一覧更新エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  return {
    refreshOfficeList: refreshOfficeList,
    refreshOfficeListSafe: refreshOfficeListSafe
  };
})();

/**
 * 事務用一覧を手動同期
 */
function refreshOfficeList() {
  OfficeListService.refreshOfficeList();
}
