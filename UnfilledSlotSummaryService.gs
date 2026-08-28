/**
 * 今後1週間の未充足募集枠サマリー
 */
var UnfilledSlotSummaryService = (function () {
  var DAYS_AHEAD = 7;

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

  function isWorkDateInRange(workDate) {
    var workKey = Utils.toDateKey(workDate);
    if (!workKey) {
      return false;
    }
    return workKey >= getTodayDateKey() && workKey <= getDateKeyPlusDays(DAYS_AHEAD);
  }

  function isUnfilledOpenSlot(slot) {
    if (slot.slotStatus !== Config.SLOT_STATUS.OPEN) {
      return false;
    }
    if (Number(slot.tentativeCount) !== 0) {
      return false;
    }
    if (Number(slot.approvedCount) !== 0) {
      return false;
    }
    return isWorkDateInRange(slot.workDate);
  }

  function compareSlots(a, b) {
    var dateA = Utils.toDateKey(a.workDate);
    var dateB = Utils.toDateKey(b.workDate);
    if (dateA !== dateB) {
      return dateA < dateB ? -1 : 1;
    }
    var facilityCmp = String(a.targetFacility).localeCompare(String(b.targetFacility), 'ja');
    if (facilityCmp !== 0) {
      return facilityCmp;
    }
    return Config.getShiftTypeLabel(a.shiftType)
      .localeCompare(Config.getShiftTypeLabel(b.shiftType), 'ja');
  }

  function findUnfilledSlots() {
    return SheetRepository.getAllSlots()
      .filter(isUnfilledOpenSlot)
      .sort(compareSlots);
  }

  function formatSlotLogLine(slot) {
    return [
      '勤務日=' + Utils.formatDate(slot.workDate),
      '勤務先=' + slot.targetFacility,
      '勤務区分=' + Config.getShiftTypeLabel(slot.shiftType),
      '職種条件=' + slot.jobCondition
    ].join(', ');
  }

  function runSummary(dryRun) {
    var slots = findUnfilledSlots();

    if (dryRun) {
      Logger.log('未充足枠サマリー dry-run');
      Logger.log('対象期間: ' + getTodayDateKey() + ' ～ ' + getDateKeyPlusDays(DAYS_AHEAD));
      Logger.log('対象件数: ' + slots.length);
      slots.forEach(function (slot) {
        Logger.log(formatSlotLogLine(slot));
      });
      return;
    }

    if (slots.length === 0) {
      Logger.log('今後1週間の未充足枠はありません。');
      return;
    }

    ChatNotify.notifyWeeklyUnfilledSlots(slots);
  }

  return {
    findUnfilledSlots: findUnfilledSlots,
    runSummary: runSummary,
    getTodayDateKey: getTodayDateKey,
    getEndDateKey: function () {
      return getDateKeyPlusDays(DAYS_AHEAD);
    }
  };
})();

/**
 * 時間主導トリガーから毎朝実行（8時台想定）
 */
function sendWeeklyUnfilledSlotSummary() {
  UnfilledSlotSummaryService.runSummary(false);
}

/**
 * 未充足枠サマリー dry-run（Chat送信なし）
 */
function testWeeklyUnfilledSlotSummaryDryRun() {
  UnfilledSlotSummaryService.runSummary(true);
}
