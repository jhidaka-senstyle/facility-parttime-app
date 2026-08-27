/**
 * スプレッドシート読み書き
 */
var SheetRepository = (function () {
  function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function getSheet(name) {
    var sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) {
      throw new Error('シート「' + name + '」が見つかりません。');
    }
    return sheet;
  }

  /**
   * getRange(row, column, numRows, numColumns) 形式で範囲を取得する。
   * 第3引数は終了行ではなく行数である点に注意。
   */
  function getDataRange(sheet, startRow, lastRow, numColumns) {
    var numRows = lastRow - startRow + 1;
    if (numRows < 1) {
      return null;
    }
    return sheet.getRange(startRow, 1, numRows, numColumns);
  }

  function getRowRange(sheet, rowIndex, numColumns) {
    return sheet.getRange(rowIndex, 1, 1, numColumns);
  }

  function getDataRows(sheetName) {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var lastCol = sheet.getLastColumn();
    var range = getDataRange(sheet, 2, lastRow, lastCol);
    return range ? range.getValues() : [];
  }

  /** @returns {Array<{code:string,name:string,applicableNames:string}>} */
  function getFacilityMaster() {
    return getDataRows(Config.SHEETS.FACILITIES).map(function (row) {
      return {
        code: String(row[0] || '').trim(),
        name: String(row[1] || '').trim(),
        applicableNames: String(row[2] || '').trim()
      };
    }).filter(function (f) {
      return f.code && f.name;
    });
  }

  /** @returns {Array<{code:string,label:string}>} */
  function getJobTypeMaster() {
    return getDataRows(Config.SHEETS.JOB_TYPES).map(function (row) {
      return {
        code: String(row[0] || '').trim(),
        label: String(row[1] || '').trim()
      };
    }).filter(function (j) {
      return j.code && j.label;
    });
  }

  /** @deprecated 互換用。getJobTypeMaster を使用 */
  function getJobTypes() {
    return getJobTypeMaster();
  }

  /** @returns {Array<{code:string,label:string}>} */
  function getShiftTypes() {
    return getDataRows(Config.SHEETS.SHIFT_TYPES).map(function (row) {
      return {
        code: String(row[0] || '').trim(),
        label: String(row[1] || '').trim()
      };
    }).filter(function (s) {
      return s.code && s.label;
    });
  }

  function rowToSlot(row) {
    return {
      slotId: String(row[0] || '').trim(),
      workDate: row[1],
      targetFacility: String(row[2] || '').trim(),
      applicableFacilities: String(row[3] || '').trim(),
      shiftType: String(row[4] || '').trim(),
      jobCondition: String(row[5] || '').trim(),
      requiredCount: Number(row[6]) || 0,
      tentativeCount: Number(row[7]) || 0,
      approvedCount: Number(row[8]) || 0,
      slotStatus: String(row[9] || '').trim(),
      createdAt: row[10],
      updatedAt: row[11]
    };
  }

  function getAllSlots() {
    return getDataRows(Config.SHEETS.SLOTS).map(rowToSlot).filter(function (s) {
      return s.slotId;
    });
  }

  function findSlotById(slotId) {
    var sheet = getSheet(Config.SHEETS.SLOTS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var range = getDataRange(sheet, 2, lastRow, 12);
    if (!range) return null;

    var data = range.getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === slotId) {
        return {
          rowIndex: i + 2,
          slot: rowToSlot(data[i])
        };
      }
    }
    return null;
  }

  function appendSlot(slot) {
    var sheet = getSheet(Config.SHEETS.SLOTS);
    sheet.appendRow([
      slot.slotId,
      slot.workDate,
      slot.targetFacility,
      slot.applicableFacilities,
      slot.shiftType,
      slot.jobCondition,
      slot.requiredCount,
      slot.tentativeCount,
      slot.approvedCount,
      slot.slotStatus,
      slot.createdAt,
      slot.updatedAt
    ]);
  }

  function updateSlotRow(rowIndex, slot) {
    var sheet = getSheet(Config.SHEETS.SLOTS);
    getRowRange(sheet, rowIndex, 12).setValues([[
      slot.slotId,
      slot.workDate,
      slot.targetFacility,
      slot.applicableFacilities,
      slot.shiftType,
      slot.jobCondition,
      slot.requiredCount,
      slot.tentativeCount,
      slot.approvedCount,
      slot.slotStatus,
      slot.createdAt,
      slot.updatedAt
    ]]);
  }

  function rowToApplication(row) {
    return {
      applicationId: String(row[0] || '').trim(),
      slotId: String(row[1] || '').trim(),
      workDate: row[2],
      workFacility: String(row[3] || '').trim(),
      homeFacility: String(row[4] || '').trim(),
      name: String(row[5] || '').trim(),
      jobType: String(row[6] || '').trim(),
      shiftType: String(row[7] || '').trim(),
      status: String(row[8] || '').trim(),
      appliedAt: row[9],
      approvedAt: row[10],
      approver: String(row[11] || '').trim(),
      deletedAt: row[12],
      deleter: String(row[13] || '').trim()
    };
  }

  function getAllApplications() {
    return getDataRows(Config.SHEETS.APPLICATIONS).map(rowToApplication).filter(function (a) {
      return a.applicationId;
    });
  }

  function findApplicationById(applicationId) {
    var sheet = getSheet(Config.SHEETS.APPLICATIONS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var range = getDataRange(sheet, 2, lastRow, 14);
    if (!range) return null;

    var data = range.getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === applicationId) {
        return {
          rowIndex: i + 2,
          application: rowToApplication(data[i])
        };
      }
    }
    return null;
  }

  function appendApplication(app) {
    var sheet = getSheet(Config.SHEETS.APPLICATIONS);
    sheet.appendRow([
      app.applicationId,
      app.slotId,
      app.workDate,
      app.workFacility,
      app.homeFacility,
      app.name,
      app.jobType,
      app.shiftType,
      app.status,
      app.appliedAt,
      app.approvedAt || '',
      app.approver || '',
      app.deletedAt || '',
      app.deleter || ''
    ]);
  }

  function updateApplicationRow(rowIndex, app) {
    var sheet = getSheet(Config.SHEETS.APPLICATIONS);
    getRowRange(sheet, rowIndex, 14).setValues([[
      app.applicationId,
      app.slotId,
      app.workDate,
      app.workFacility,
      app.homeFacility,
      app.name,
      app.jobType,
      app.shiftType,
      app.status,
      app.appliedAt,
      app.approvedAt || '',
      app.approver || '',
      app.deletedAt || '',
      app.deleter || ''
    ]]);
  }

  function getApplicationsBySlotId(slotId) {
    return getAllApplications().filter(function (a) {
      return a.slotId === slotId;
    });
  }

  /**
   * 募集枠IDで行を特定し、該当行のみ物理削除する
   * @returns {boolean} 削除成功
   */
  function deleteSlotRow(slotId) {
    var found = findSlotById(slotId);
    if (!found) {
      return false;
    }
    var sheet = getSheet(Config.SHEETS.SLOTS);
    sheet.deleteRow(found.rowIndex);
    return true;
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getFacilityMaster: getFacilityMaster,
    getJobTypes: getJobTypes,
    getJobTypeMaster: getJobTypeMaster,
    getShiftTypes: getShiftTypes,
    getAllSlots: getAllSlots,
    findSlotById: findSlotById,
    appendSlot: appendSlot,
    updateSlotRow: updateSlotRow,
    getAllApplications: getAllApplications,
    findApplicationById: findApplicationById,
    appendApplication: appendApplication,
    updateApplicationRow: updateApplicationRow,
    getApplicationsBySlotId: getApplicationsBySlotId,
    deleteSlotRow: deleteSlotRow
  };
})();
