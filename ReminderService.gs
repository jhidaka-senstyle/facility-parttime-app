/**
 * 勤務3日前リマインド
 */
var ReminderService = (function () {
  var REMINDER_DAYS_BEFORE = 3;

  function getScriptTimeZone() {
    return Session.getScriptTimeZone() || 'Asia/Tokyo';
  }

  function getTodayDateKey() {
    return Utilities.formatDate(new Date(), getScriptTimeZone(), 'yyyy-MM-dd');
  }

  function getDateKeyPlusDays(days) {
    var tz = getScriptTimeZone();
    var todayKey = getTodayDateKey();
    var parts = todayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + days);
    return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  }

  function isWorkDateExactlyDaysFromToday(workDate, days) {
    var workKey = Utils.toDateKey(workDate);
    if (!workKey) {
      return false;
    }
    return workKey === getDateKeyPlusDays(days);
  }

  function hasReminderSent(app) {
    if (!app.reminderSentAt) {
      return false;
    }
    if (app.reminderSentAt instanceof Date) {
      return !isNaN(app.reminderSentAt.getTime());
    }
    return String(app.reminderSentAt).trim() !== '';
  }

  function isReminderTarget(app) {
    if (app.status !== Config.APP_STATUS.APPROVED) {
      return false;
    }
    if (!String(app.email || '').trim()) {
      return false;
    }
    if (hasReminderSent(app)) {
      return false;
    }
    return isWorkDateExactlyDaysFromToday(app.workDate, REMINDER_DAYS_BEFORE);
  }

  function getConfirmedShiftCode(app, slot) {
    if (slot) {
      var slotCode = Config.resolveShiftCode(slot.shiftType);
      if (slotCode === 'FULLDAY' || slotCode === 'AM' || slotCode === 'PM') {
        return slotCode;
      }
    }
    return Config.getEffectivePreferredShiftCode(app);
  }

  function buildSlotMap() {
    var map = {};
    SheetRepository.getAllSlots().forEach(function (slot) {
      map[slot.slotId] = slot;
    });
    return map;
  }

  function findReminderTargets() {
    var slotMap = buildSlotMap();
    return SheetRepository.getAllApplications()
      .filter(isReminderTarget)
      .map(function (app) {
        var slot = slotMap[app.slotId] || null;
        return {
          application: app,
          slot: slot,
          confirmedShiftCode: getConfirmedShiftCode(app, slot)
        };
      });
  }

  function logTargetSummary(targets) {
    Logger.log('3日前リマインド対象件数: ' + targets.length);
    Logger.log('基準日（今日）: ' + getTodayDateKey());
    Logger.log('対象勤務日: ' + getDateKeyPlusDays(REMINDER_DAYS_BEFORE));
    targets.forEach(function (item) {
      var app = item.application;
      Logger.log(
        '応募ID=' + app.applicationId +
        ', 氏名=' + app.name +
        ', 勤務日=' + Utils.formatDate(app.workDate) +
        ', 宛先=' + app.email
      );
    });
  }

  function processReminders(dryRun) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      if (!dryRun) {
        lock.waitLock(30000);
        hasLock = true;
      }

      var targets = findReminderTargets();
      logTargetSummary(targets);

      if (dryRun) {
        Logger.log('dry-run のためメール送信・シート更新は行いません。');
        return {
          dryRun: true,
          count: targets.length
        };
      }

      var sentCount = 0;
      var failedCount = 0;

      targets.forEach(function (item) {
        var appFound = SheetRepository.findApplicationById(item.application.applicationId);
        if (!appFound) {
          Logger.log('応募が見つかりません: ' + item.application.applicationId);
          failedCount++;
          return;
        }

        var app = appFound.application;
        if (!isReminderTarget(app)) {
          Logger.log('処理済みまたは対象外のためスキップ: ' + app.applicationId);
          return;
        }

        var slotMap = buildSlotMap();
        var slot = slotMap[app.slotId] || null;
        var confirmedShiftCode = getConfirmedShiftCode(app, slot);
        var sent = MailNotify.sendThreeDayReminder(app, confirmedShiftCode);
        if (sent) {
          app.reminderSentAt = Utils.now();
          SheetRepository.updateApplicationRow(appFound.rowIndex, app);
          sentCount++;
        } else {
          failedCount++;
        }
      });

      Logger.log('3日前リマインド送信完了: 成功=' + sentCount + ', 失敗=' + failedCount);
      return {
        dryRun: false,
        sentCount: sentCount,
        failedCount: failedCount
      };
    } catch (e) {
      Logger.log('3日前リマインド処理エラー: ' + e.message);
      if (e.stack) {
        Logger.log(e.stack);
      }
      throw e;
    } finally {
      if (hasLock) {
        lock.releaseLock();
      }
    }
  }

  return {
    findReminderTargets: findReminderTargets,
    processReminders: processReminders,
    isReminderTarget: isReminderTarget,
    getTodayDateKey: getTodayDateKey,
    getTargetWorkDateKey: function () {
      return getDateKeyPlusDays(REMINDER_DAYS_BEFORE);
    }
  };
})();

/**
 * 時間主導トリガーから毎日実行（17時台想定）
 */
function sendThreeDayReminders() {
  ReminderService.processReminders(false);
}

/**
 * 対象確認用 dry-run（メール送信・シート更新なし）
 */
function testThreeDayRemindersDryRun() {
  ReminderService.processReminders(true);
}
