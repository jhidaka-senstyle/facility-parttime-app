/**
 * 事務長用ページ（1人1行）同期
 */
var OfficeManagerListService = (function () {
  var SHEET_NAME = '事務長用ページ';
  var MANAGED_COLS = 7;
  var DATA_START_ROW = 2;
  var KEY_SEPARATOR = '｜';

  function getSheet() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('シート「' + SHEET_NAME + '」が見つかりません。');
    }
    return sheet;
  }

  function buildStaffKey(app) {
    var facility = String(app.homeFacility || '').trim();
    var name = String(app.name || '').trim();
    var email = String(app.email || '').trim().toLowerCase();
    if (email) {
      return facility + KEY_SEPARATOR + name + KEY_SEPARATOR + email;
    }
    return facility + KEY_SEPARATOR + name;
  }

  function getApplicationTimestamp(app) {
    var applied = Utils.parseDate(app.appliedAt);
    if (applied) {
      return applied.getTime();
    }
    var work = Utils.parseDate(app.workDate);
    if (work) {
      return work.getTime();
    }
    return 0;
  }

  function findLatestApplication(apps) {
    return apps.reduce(function (latest, app) {
      if (!latest) {
        return app;
      }
      return getApplicationTimestamp(app) >= getApplicationTimestamp(latest) ? app : latest;
    }, null);
  }

  function getLastAppliedDisplay(apps) {
    var maxApplied = null;
    apps.forEach(function (app) {
      var applied = Utils.parseDate(app.appliedAt);
      if (applied && (!maxApplied || applied.getTime() > maxApplied.getTime())) {
        maxApplied = applied;
      }
    });
    if (maxApplied) {
      return Utils.formatDateTime(maxApplied);
    }

    var maxWork = null;
    apps.forEach(function (app) {
      var work = Utils.parseDate(app.workDate);
      if (work && (!maxWork || work.getTime() > maxWork.getTime())) {
        maxWork = work;
      }
    });
    return maxWork ? Utils.formatDate(maxWork) : '';
  }

  function groupApplicationsByStaff(applications) {
    var groups = {};
    applications.forEach(function (app) {
      var key = buildStaffKey(app);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(app);
    });
    return groups;
  }

  function buildPersonEntry(staffKey, apps) {
    var latest = findLatestApplication(apps);
    return {
      staffKey: staffKey,
      homeFacility: latest.homeFacility,
      name: latest.name,
      jobTypeLabel: Config.getJobTypeLabel(latest.jobType),
      email: latest.email || '',
      applicationCount: apps.length,
      lastAppliedAt: getLastAppliedDisplay(apps),
      sortFacility: latest.homeFacility,
      sortName: latest.name
    };
  }

  function buildManagedCells(entry) {
    return [
      entry.staffKey,
      entry.homeFacility,
      entry.name,
      entry.jobTypeLabel,
      entry.email,
      entry.applicationCount,
      entry.lastAppliedAt
    ];
  }

  function compareEntries(a, b) {
    var facilityCmp = String(a.sortFacility).localeCompare(String(b.sortFacility), 'ja');
    if (facilityCmp !== 0) {
      return facilityCmp;
    }
    return String(a.sortName).localeCompare(String(b.sortName), 'ja');
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
        staffKey: String(row[0] || '').trim(),
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

  function refreshOfficeManagerList() {
    var sheet = getSheet();
    var lastCol = Math.max(sheet.getLastColumn(), MANAGED_COLS);
    var applications = SheetRepository.getAllApplications();
    var groups = groupApplicationsByStaff(applications);

    var existingRows = readExistingRows(sheet, lastCol);
    var existingByKey = {};
    existingRows.forEach(function (row) {
      if (row.staffKey) {
        existingByKey[row.staffKey] = row;
      }
    });

    var orphanRows = existingRows
      .filter(function (row) {
        return !row.staffKey;
      })
      .map(function (row) {
        return padRow(row.fullRow, lastCol);
      });

    var outputEntries = Object.keys(groups).map(function (staffKey) {
      var entry = buildPersonEntry(staffKey, groups[staffKey]);
      var managedCells = buildManagedCells(entry);
      var existing = existingByKey[staffKey];
      var fullRow = existing
        ? mergeManagedCells(existing.fullRow, managedCells, lastCol)
        : mergeManagedCells([], managedCells, lastCol);

      return {
        staffKey: staffKey,
        sortFacility: entry.sortFacility,
        sortName: entry.sortName,
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

  function refreshOfficeManagerListSafe() {
    try {
      refreshOfficeManagerList();
    } catch (e) {
      Logger.log('事務長用ページ更新エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
    }
  }

  return {
    refreshOfficeManagerList: refreshOfficeManagerList,
    refreshOfficeManagerListSafe: refreshOfficeManagerListSafe
  };
})();

/**
 * 事務長用ページを手動同期
 */
function refreshOfficeManagerList() {
  OfficeManagerListService.refreshOfficeManagerList();
}
